import { supabase } from "@/integrations/supabase/client";

interface CrawlResult {
  url: string;
  title?: string;
  error?: string;
}

/**
 * Extracts internal links from HTML content
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi;
  const links: string[] = [];
  const baseDomain = new URL(baseUrl).hostname;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[2];
    try {
      const url = new URL(href, baseUrl);
      // Only include internal links (same domain)
      if (url.hostname === baseDomain && url.protocol.startsWith('http')) {
        // Remove hash and query params for deduplication
        const cleanUrl = url.origin + url.pathname;
        if (cleanUrl !== baseUrl && !links.includes(cleanUrl)) {
          links.push(cleanUrl);
        }
      }
    } catch {
      // Skip invalid URLs
    }
  }
  
  return links.slice(0, 50); // Limit to 50 links
}

/**
 * Crawls a website and returns a list of internal URLs
 */
export async function crawlSite(url: string, depth: number = 1): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue: string[] = [url];
  
  while (queue.length > 0 && results.length < 50) {
    const currentUrl = queue.shift()!;
    
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);
    
    try {
      const response = await fetch(currentUrl);
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
      is_parent: true,
      total_pages: 0,
      created_at: new Date().toISOString(),
    } as any)
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

/**
 * Links a child audit to a parent audit
 */
export async function linkChildAudit(parentId: string, childId: string): Promise<void> {
  const { error } = await supabase
    .from('audits')
    .update({ parent_audit_id: parentId } as any)
    .eq('id', childId);
  
  if (error) throw error;
}

/**
 * Updates parent audit with aggregated scores
 */
export async function updateParentAudit(parentId: string): Promise<void> {
  // Placeholder until migration is run
  console.log('updateParentAudit called for', parentId);
}
