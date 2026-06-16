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
    
    // Add the main URL first
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
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
      results.push({ url, error: error instanceof Error ? error.message : 'Unknown error' });
      visited.add(url);
    }
    
    // Crawl additional pages
    while (queue.length > 0 && results.length < 50) {
      const currentUrl = queue.shift()!;
      
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      
      try {
        const response = await fetch(currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        if (!response.ok) {
          results.push({ url: currentUrl, error: `HTTP ${response.status}` });
          continue;
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
        results.push({ url: currentUrl, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    return results;
  });

/**
 * Crawls a website and returns a list of internal URLs (client-side fallback)
 */
export async function crawlSite(url: string, depth: number = 2): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue: string[] = [url];
  
  // Add the main URL first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
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
    results.push({ url, error: error instanceof Error ? error.message : 'Unknown error' });
    visited.add(url);
  }
  
  // Crawl additional pages
  while (queue.length > 0 && results.length < 50) {
    const currentUrl = queue.shift()!;
    
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);
    
    try {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!response.ok) {
        results.push({ url: currentUrl, error: `HTTP ${response.status}` });
        continue;
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
      results.push({ url: currentUrl, error: error instanceof Error ? error.message : 'Unknown error' });
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
