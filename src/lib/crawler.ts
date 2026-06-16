import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

interface CrawlResult {
  url: string;
  title?: string;
  error?: string;
}

/**
 * Extracts internal links from HTML content
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const baseDomain = new URL(baseUrl).hostname;
  const baseOrigin = new URL(baseUrl).origin;
  
  // More comprehensive regex patterns for href attributes
  const patterns = [
    /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
    /<a\s+href=(["'])(.*?)\1/gi,
    /href=(["'])(.*?)\1/gi
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const href = match[2];
      try {
        const url = new URL(href, baseUrl);
        // Only include internal links (same domain)
        if (url.hostname === baseDomain && url.protocol.startsWith('http')) {
          // Remove hash and query params for deduplication
          const cleanUrl = url.origin + url.pathname;
          // Normalize trailing slash
          const normalizedUrl = cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl;
          const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
          
          if (normalizedUrl !== normalizedBaseUrl && !links.includes(normalizedUrl)) {
            // Filter out common non-page URLs
            if (!normalizedUrl.match(/\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|json|zip|tar|gz)$/i)) {
              links.push(normalizedUrl);
            }
          }
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }
  
  return links.slice(0, 50); // Limit to 50 links
}

/**
 * Server-side crawl function to bypass CORS
 */
export const crawlSiteServer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    url: z.string().url(),
    depth: z.number().default(2),
  }))
  .handler(async ({ data }) => {
    const { url, depth } = data;
    const results: CrawlResult[] = [];
    const visited = new Set<string>();
    const queue: string[] = [url];
    
    const fetchWithTimeout = async (fetchUrl: string, timeoutMs: number = 15000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0'
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };
    
    // Add the main URL first
    try {
      const response = await fetchWithTimeout(url, 15000);
      if (response.ok) {
        const html = await response.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : undefined;
        results.push({ url, title });
        visited.add(url);
        console.log(`[crawlSiteServer] Successfully fetched main page: ${url}`);
        
        // Extract links for next level
        if (depth > 0) {
          const links = extractLinks(html, url);
          console.log(`[crawlSiteServer] Extracted ${links.length} links from main page`);
          for (const link of links) {
            if (!visited.has(link) && results.length < 50) {
              queue.push(link);
            }
          }
        }
      } else {
        results.push({ url, error: `HTTP ${response.status}` });
        visited.add(url);
        console.error(`[crawlSiteServer] Failed to fetch main page: HTTP ${response.status}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ url, error: errorMsg });
      visited.add(url);
      console.error(`[crawlSiteServer] Error fetching main page:`, errorMsg);
    }
    
    // Crawl additional pages with concurrency limit
    const maxConcurrent = 3;
    let activeRequests = 0;
    
    const processUrl = async (currentUrl: string): Promise<void> => {
      if (visited.has(currentUrl) || results.length >= 50) return;
      visited.add(currentUrl);
      activeRequests++;
      
      try {
        const response = await fetchWithTimeout(currentUrl, 12000);
        if (!response.ok) {
          results.push({ url: currentUrl, error: `HTTP ${response.status}` });
          console.error(`[crawlSiteServer] Failed to fetch ${currentUrl}: HTTP ${response.status}`);
          return;
        }
        
        const html = await response.text();
        
        // Extract title
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : undefined;
        
        results.push({ url: currentUrl, title });
        console.log(`[crawlSiteServer] Successfully crawled: ${currentUrl} (${results.length}/50)`);
        
        // Extract links for next level if depth > 0
        if (depth > 0) {
          const links = extractLinks(html, currentUrl);
          for (const link of links) {
            if (!visited.has(link) && results.length < 50) {
              queue.push(link);
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ url: currentUrl, error: errorMsg });
        console.error(`[crawlSiteServer] Error crawling ${currentUrl}:`, errorMsg);
      } finally {
        activeRequests--;
      }
    };
    
    // Process queue with concurrency control
    while (queue.length > 0 && results.length < 50) {
      const batch = queue.splice(0, Math.min(maxConcurrent - activeRequests, queue.length));
      await Promise.all(batch.map(processUrl));
      
      // Small delay between batches to be respectful
      if (queue.length > 0 && results.length < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[crawlSiteServer] Crawl complete. Found ${results.length} pages.`);
    return results;
  });

/**
 * Crawls a website and returns a list of internal URLs (client-side fallback)
 */
export async function crawlSite(url: string, depth: number = 2): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue: string[] = [url];
  
  const fetchWithTimeout = async (fetchUrl: string, timeoutMs: number = 12000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0'
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };
  
  // Add the main URL first
  try {
    const response = await fetchWithTimeout(url, 12000);
    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;
      results.push({ url, title });
      visited.add(url);
      
      // Extract links for next level
      if (depth > 0) {
        const links = extractLinks(html, url);
        for (const link of links) {
          if (!visited.has(link) && results.length < 50) {
            queue.push(link);
          }
        }
      }
    } else {
      results.push({ url, error: `HTTP ${response.status}` });
      visited.add(url);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    results.push({ url, error: errorMsg });
    visited.add(url);
  }
  
  // Crawl additional pages with concurrency limit
  const maxConcurrent = 2;
  let activeRequests = 0;
  
  const processUrl = async (currentUrl: string): Promise<void> => {
    if (visited.has(currentUrl) || results.length >= 50) return;
    visited.add(currentUrl);
    activeRequests++;
    
    try {
      const response = await fetchWithTimeout(currentUrl, 10000);
      if (!response.ok) {
        results.push({ url: currentUrl, error: `HTTP ${response.status}` });
        return;
      }
      
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;
      
      results.push({ url: currentUrl, title });
      
      // Extract links for next level if depth > 0
      if (depth > 0) {
        const links = extractLinks(html, currentUrl);
        for (const link of links) {
          if (!visited.has(link) && results.length < 50) {
            queue.push(link);
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ url: currentUrl, error: errorMsg });
    } finally {
      activeRequests--;
    }
  };
  
  // Process queue with concurrency control
  while (queue.length > 0 && results.length < 50) {
    const batch = queue.splice(0, Math.min(maxConcurrent - activeRequests, queue.length));
    await Promise.all(batch.map(processUrl));
    
    if (queue.length > 0 && results.length < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Creates a parent audit record for multi-page audits
 */
export async function createParentAudit(userId: string, url: string): Promise<string> {
  const { data, error } = await supabase
    .from('audits')
    .insert({
      user_id: userId,
      url,
      overall_score: 0,
      violations: [],
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

/**
 * Links a child audit to a parent audit (placeholder for future schema update)
 */
export async function linkChildAudit(parentId: string, childId: string): Promise<void> {
  // TODO: Implement when parent_audit_id column is added to schema
  console.log(`Linking child ${childId} to parent ${parentId} (schema update needed)`);
}

/**
 * Updates parent audit with aggregated scores (placeholder for future schema update)
 */
export async function updateParentAudit(parentId: string): Promise<void> {
  // TODO: Implement when is_parent and total_pages columns are added to schema
  console.log(`Updating parent audit ${parentId} (schema update needed)`);
}
