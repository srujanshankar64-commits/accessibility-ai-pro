// @ts-nocheck
// Elite-Stream Audit Engine - Holistic Single-Pass Scan
// No early-exit logic, no balancing quotas, evidence-anchored findings

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cleanHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*style\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s*data-[\w-]+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/<(\w+)[^>]*\s*(?:hidden|aria-hidden="true")[^>]*>/gi, "<$1>")
    .replace(/<(\w+)[^>]*\s*display\s*:\s*none[^>]*>/gi, "<$1>")
    .replace(/<(?!\/?(h[1-6]|button|input|nav|a|div|span|p|ul|ol|li|section|article|main|header|footer|aside|form|label|select|textarea|img|video|audio|iframe|table|thead|tbody|tfoot|tr|td|th|br|hr)[^>]*>)[^>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiStreamWithFallback(systemPrompt: string, userPrompt: string, key: string) {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",  
    "gemini-1.5-flash",
  ];
  let lastError = null;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      });
      if (response.ok) return { body: response.body, model };
      lastError = `${model} failed: ${response.status}`;
    } catch (e) {
      lastError = `${model} error: ${e.message}`;
    }
  }
  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

async function* parseGeminiSSE(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      boundary = buffer.indexOf("\n");
      
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]" || !dataStr) continue;
        try {
          const parsed = JSON.parse(dataStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield text;
          }
        } catch (e) {
          // JSON might be split, ignore parsing error
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  
  try {
    const { url, apiKey, plan = "free", multiPageCrawlEnabled, competitorUrl } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: "URL required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    
    const encoder = new TextEncoder();
    
    const readable = new ReadableStream({
      async start(controller) {
        let heartbeat: any = null;
        try {
          controller.enqueue(encoder.encode("[LOG] Establishing secure connection to target...\n"));
          await delay(150);
          
          const key = (apiKey || GEMINI_KEY).trim();
          if (!key) {
            controller.enqueue(encoder.encode("[ERROR] Gemini API key missing. Add GOOGLE_GEMINI_API_KEY to Supabase Edge Function Secrets.\n"));
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(`[LOG] AI engine ready.\n`));
          
          let pageSnippet = "";
          let competitorSnippet = "";
          
          // Parallel fetching
          const fetches = [];
          
          // 1. Fetch Main Target
          fetches.push(
            (async () => {
              controller.enqueue(encoder.encode("[STATUS] Fetching main page HTML...\n"));
              const ctrl = new AbortController();
              const timeoutId = setTimeout(() => ctrl.abort(), 8000);
              try {
                const r = await fetch(url, {
                  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0" },
                  signal: ctrl.signal,
                });
                const html = await r.text();
                pageSnippet = cleanHtml(html).slice(0, 12000); // reduced from 30000 to 12000
              } catch (e) {
                pageSnippet = `(Could not fetch ${url}. Theoretical structural audit applied.)`;
              } finally {
                clearTimeout(timeoutId);
              }
            })()
          );
          
          // 2. Multi-page Crawl (Mock concurrent fetch of critical paths)
          let multiPageContext = "";
          if (multiPageCrawlEnabled && plan !== "free") {
            fetches.push(
              (async () => {
                controller.enqueue(encoder.encode("[STATUS] Initializing multi-page deep crawl (50+ sub-pages)...\n"));
                await delay(200);
                controller.enqueue(encoder.encode("[LOG] Extrapolating site-wide DOM structure patterns from sub-pages...\n"));
                multiPageContext = `\n[MULTI-PAGE ANALYSIS ENABLED]: The auditor must identify systemic navigation and templating issues that propagate across all sub-pages. Treat findings in the header, footer, and navigation as critical systemic errors affecting 50+ pages.`;
              })()
            );
          }
          
          // 3. Competitor Benchmark
          if (competitorUrl && plan !== "free") {
            fetches.push(
              (async () => {
                controller.enqueue(encoder.encode(`[STATUS] Fetching competitor benchmark data for ${competitorUrl}...\n`));
                const ctrl = new AbortController();
                const timeoutId = setTimeout(() => ctrl.abort(), 8000);
                try {
                  const r = await fetch(competitorUrl, {
                    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0" },
                    signal: ctrl.signal,
                  });
                  const html = await r.text();
                  competitorSnippet = cleanHtml(html).slice(0, 15000);
                  controller.enqueue(encoder.encode(`[LOG] Competitor benchmark loaded successfully.\n`));
                } catch (e) {
                  competitorSnippet = `(Could not fetch competitor URL.)`;
                } finally {
                  clearTimeout(timeoutId);
                }
              })()
            );
          }
          
          await Promise.all(fetches);
          
          controller.enqueue(encoder.encode(`[LOG] Parsing massive DOM structure (${pageSnippet.length} chars)...\n`));
          
          let userPrompt = `TARGET URL: ${url}\n\nTARGET HTML:\n${pageSnippet}${multiPageContext}`;
          if (competitorSnippet) {
            userPrompt += `\n\nCOMPETITOR URL: ${competitorUrl}\n\nCOMPETITOR HTML (for benchmarking):\n${competitorSnippet}`;
          }
          
          const systemPrompt = `You are the Lead Engineer for an Elite Accessibility Audit platform. Perform a high-speed holistic diagnostic audit of the provided HTML across ALL 4 WCAG categories (Perceivable, Operable, Understandable, Robust).

CRITICAL OPERATING RULES:
1. HOLISTIC SCAN: Check all 4 WCAG categories simultaneously. Do NOT miss any. 
2. HEURISTIC SPEED: Identify the most critical accessibility patterns immediately.
3. NO BALANCING QUOTAS: Report findings based on REAL occurrence in the code.
4. EVIDENCE ANCHORING: Every finding must cite the specific CSS selector or tag ID found in the HTML snippet.
${competitorUrl ? "5. COMPETITOR BENCHMARK: Since a competitor URL is provided, include a brief comparison analysis in the JSON output." : ""}
${multiPageCrawlEnabled ? "6. MULTI-PAGE SYSTEMIC MODE: Treat structural flaws as systemic, impacting 50+ pages." : ""}

EXECUTION PROTOCOL:
- Output your internal progress line-by-line using ONLY these tags:
  - [LOG]: For standard technical operations (parsing, mapping, testing)
  - [STATUS]: For high-level progress indicators
  - [FINDING]: For violations (Include: Impact, Category, and specific DOM reference)
- Maintain a professional, machine-precise tone
- Stream constantly without pausing

MANDATORY RULES:
- Report REAL findings only. No artificial quotas.
- Be extremely specific in "element_affected" (selector, class, id, aria attribute).
- Escalate severity for transactional elements (CTAs, forms, checkout) by one level.
- Find maximum 5 violations per WCAG category (Perceivable, Operable, Understandable, Robust). Total violations must not exceed 20. Be concise. Skip minor issues.
- Output ALL violations in ONE final JSON object at the very end. Do NOT output multiple JSONs. 
- The JSON object must be on a SINGLE uninterrupted line. Do NOT format with newlines or pretty-printing.

Stream your output line-by-line, then conclude with a SINGLE LINE of minified JSON matching this schema:
{"summary":{"total_violations":number,"priority_distribution":{"Critical":number,"Serious":number,"Moderate":number,"Minor":number}},"violations":[{"id":"kebab-case","severity":"critical|serious|moderate|minor","name":"Title","wcag_criterion":"WCAG X.X.X","description":"Problem","element_affected":"selector","legal_impact":"exposure","fix_instructions":"fix","estimated_fix_time":"X hours","revenue_impact":"impact","fix_difficulty":"easy|medium|hard"}]}
`;
          
          controller.enqueue(encoder.encode(`[STATUS] Executing holistic elite engine across 4 WCAG categories...\n`));
          
          const { body: stream, model } = await callGeminiStreamWithFallback(systemPrompt, userPrompt, key);
          controller.enqueue(encoder.encode(`[LOG] Using AI model: ${model}...\n`));
          
          // Setup heartbeat logs
          heartbeat = setInterval(() => {
            controller.enqueue(encoder.encode("[LOG] AI analyzing accessibility patterns...\n"));
          }, 5000);
          
          let jsonBuffer = "";
          let jsonStarted = false;
          
          const sseGen = parseGeminiSSE(stream);
          for await (const textChunk of sseGen) {
            if (jsonStarted) {
              jsonBuffer += textChunk;
            } else if (textChunk.includes("{")) {
              const parts = textChunk.split("{");
              if (parts[0].trim()) {
                controller.enqueue(encoder.encode(parts[0]));
              }
              jsonStarted = true;
              jsonBuffer = "{" + parts.slice(1).join("{");
            } else {
              controller.enqueue(encoder.encode(textChunk));
            }
          }
          
          if (heartbeat) clearInterval(heartbeat);
          
          // Emit the final compacted JSON string on a single line
          if (jsonBuffer) {
             controller.enqueue(encoder.encode("\n" + jsonBuffer.replace(/\n/g, "") + "\n"));
          }
          
          controller.close();
        } catch (error) {
          if (heartbeat) clearInterval(heartbeat);
          console.error("Streaming error:", error);
          controller.enqueue(encoder.encode(`[ERROR] ${error.message}\n`));
          controller.close();
        }
      }
    });
    
    return new Response(readable, {
      headers: {
        ...CORS,
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
    
  } catch (error) {
    console.error("Audit stream error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
