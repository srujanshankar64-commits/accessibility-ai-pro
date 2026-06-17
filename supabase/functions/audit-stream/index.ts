// @ts-nocheck
// Streaming WCAG audit endpoint - returns ReadableStream for real-time progress

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

function parseJSON(s: string) {
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return {};
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiStream(systemPrompt: string, userPrompt: string, apiKey: string) {
  const key = (apiKey || GEMINI_KEY).trim();
  if (!key) throw new Error("Gemini API key not configured");
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${key}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: {
        responseMimeType: "text/plain",
        temperature: 0.2,
        maxOutputTokens: 81920,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini ${response.status}: ${error.slice(0, 200)}`);
  }
  
  return response.body;
}

const CATEGORIES = [
  {
    key: "perceivable",
    label: "Perceivable (images, contrast, media)",
    criteria: "1.1.1 alt text, 1.2.x captions/transcripts, 1.3.x structure, 1.4.x contrast/resize/reflow, color-only info, prefers-reduced-motion.",
  },
  {
    key: "operable",
    label: "Operable (keyboard, focus, navigation)",
    criteria: "2.1.x keyboard reachable & no traps, 2.2.x timing/auto-play, 2.4.x focus order/indicator/skip-link/link-text, 2.5.5 touch targets >=44x44px.",
  },
  {
    key: "understandable",
    label: "Understandable (forms, language, errors)",
    criteria: "3.1.x lang & abbreviations, 3.2.x consistent nav, 3.3.x form labels/errors/validation.",
  },
  {
    key: "robust",
    label: "Robust (ARIA, semantics, iframes)",
    criteria: "4.1.x valid HTML, ARIA roles/landmarks/widgets (modals, dropdowns, tabs, carousels, tooltips, accordions), iframe titles, headings, page title.",
  },
];

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  
  try {
    const { url, apiKey, plan = "free" } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: "URL required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    
    // Fetch and clean HTML
    let pageSnippet = "";
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0 (WCAG Compliance Scanner)" },
        signal: ctrl.signal,
      });
      const html = await r.text();
      pageSnippet = cleanHtml(html).slice(0, 12000);
    } catch (e) {
      pageSnippet = `(Could not fetch ${url}. Perform a thorough theoretical WCAG 2.1 AA audit based on the URL.)`;
    }
    
    const violationLimit = plan === "free" ? 5 : 26;
    const userPrompt = `URL: ${url}\n\nHTML content:\n${pageSnippet}`;
    
    // Create a TransformStream to process the streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Start streaming in background
    (async () => {
      try {
        for (const cat of CATEGORIES) {
          // Import the streaming system prompt
          const systemPrompt = `You are the primary engine for an elite accessibility diagnostic platform. Perform a deep-dive WCAG 2.1 audit and stream the results in real-time.

EXECUTION PROTOCOL:
1. TECHNICAL DEPTH: Reference specific DOM elements, CSS classes, IDs, and aria-attributes (e.g., 'Analyzing <button id='nav'>...').
2. REAL-TIME STREAMING: Output your internal progress line-by-line. Use ONLY these tags:
   - [LOG]: For standard technical operations (parsing, mapping, testing).
   - [STATUS]: For high-level progress indicators (e.g., "Category: Perceivable... 45%").
   - [FINDING]: For violations (Include: Impact, Category, and specific DOM reference).
3. VARIETY: Adapt your commentary to the specific URL structure. No two audits should look the same.
4. JSON FINALIZATION: Conclude the stream with a final JSON object: {"category": "string", "total_found": "number", "violations": [...]}.
5. STREAMING PACE: Maintain a professional, machine-precise tone. Stream constantly without pausing.

Audit ONLY the ${cat.key.toUpperCase()} category. Criteria covered: ${cat.criteria}

MANDATORY RULES:
- Return exactly ${violationLimit} violations. Every instance is a separate violation.
- Be extremely specific in "element_affected" (selector, class, id, aria attribute).
- Escalate severity for transactional elements (CTAs, forms, checkout) by one level.
- Include mobile-specific issues as [MOBILE] prefixed entries when relevant.

ETHICAL GUARDRAILS:
- When reporting industry benchmarks or SEO impact, use neutral, non-prescriptive language.
- Example: 'Industry standards suggest compliance can impact SEO; individual results may vary.'
- Do not invent specific percentages or threaten EU fines; refer to general 'legal accessibility requirements'.

Stream your output line-by-line, then conclude with JSON:
{
  "category": "${cat.key}",
  "total_found": number,
  "violations": [
    {
      "id": "kebab-case-id",
      "severity": "critical"|"serious"|"moderate"|"minor",
      "name": "Short title",
      "wcag_criterion": "WCAG X.X.X",
      "description": "Plain English problem",
      "element_affected": "Specific element/selector",
      "legal_impact": "EU EAA, ADA, AODA, UK Equality Act exposure",
      "fix_instructions": "Concrete fix",
      "estimated_fix_time": "X hours",
      "revenue_impact": "How it affects conversions/excludes users",
      "fix_difficulty": "easy"|"medium"|"hard"
    }
  ]
}`;
          
          // Add cooldown between categories
          if (cat !== CATEGORIES[0]) {
            await delay(250);
          }
          
          // Stream the category scan
          const stream = await callGeminiStream(systemPrompt, userPrompt, apiKey);
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            await writer.write(encoder.encode(chunk));
          }
        }
        
        await writer.close();
      } catch (error) {
        console.error("Streaming error:", error);
        await writer.write(encoder.encode(`[ERROR] ${error.message}\n`));
        await writer.close();
      }
    })();
    
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
