import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

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

export const performFastAudit = createServerFn({ method: "POST" })
  .inputValidator(z.object({ 
    url: z.string().url(),
    apiKey: z.string().optional(),
    multiPageCrawlEnabled: z.boolean().optional(),
    competitorUrl: z.string().optional(),
    plan: z.string().optional()
  }))
  .handler(async ({ data }) => {
    const { url, apiKey: userApiKey, multiPageCrawlEnabled, competitorUrl, plan = "free" } = data;
    const apiKey = (process.env.GOOGLE_GEMINI_API_KEY || userApiKey)?.trim();
    if (!apiKey) throw new Error("API Key not found");

    const ai = new GoogleGenAI({ apiKey });

    // Fetch HTML
    let pageSnippet = "";
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await r.text();
      pageSnippet = cleanHtml(html).slice(0, 30000);
    } catch (e) {
      pageSnippet = `(Could not fetch ${url})`;
    }

    let multiPageContext = "";
    if (multiPageCrawlEnabled && plan !== "free") {
      multiPageContext = `\n[MULTI-PAGE ANALYSIS ENABLED]: Treat findings in the header, footer, and navigation as critical systemic errors affecting 50+ pages.`;
    }

    let competitorSnippet = "";
    if (competitorUrl && plan !== "free") {
      try {
        const r = await fetch(competitorUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await r.text();
        competitorSnippet = cleanHtml(html).slice(0, 15000);
      } catch (e) {
        competitorSnippet = `(Could not fetch ${competitorUrl})`;
      }
    }

    let userPrompt = `TARGET URL: ${url}\n\nTARGET HTML:\n${pageSnippet}${multiPageContext}`;
    if (competitorSnippet) {
      userPrompt += `\n\nCOMPETITOR URL: ${competitorUrl}\n\nCOMPETITOR HTML (for benchmarking):\n${competitorSnippet}`;
    }

    const systemPrompt = `You are an Elite Accessibility Audit platform. Perform a high-speed holistic diagnostic audit of the provided HTML across ALL 4 WCAG categories (Perceivable, Operable, Understandable, Robust).
Return raw JSON ONLY. No markdown formatting.
{"summary":{"total_violations":number,"priority_distribution":{"Critical":number,"Serious":number,"Moderate":number,"Minor":number}},"violations":[{"id":"kebab-case","severity":"critical|serious|moderate|minor","category":"perceivable|operable|understandable|robust","name":"Title","wcag_criterion":"WCAG X.X.X","description":"Problem","element_affected":"selector","legal_impact":"exposure","fix_instructions":"fix","estimated_fix_time":"X hours","revenue_impact":"impact","fix_difficulty":"easy|medium|hard"}]}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
  });
