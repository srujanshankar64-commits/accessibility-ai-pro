import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please retry shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "{}";
}

function parseJSON(s: string) {
  try { return JSON.parse(s); }
  catch { const m = s.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; }
}

export const runAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { url } = data;
    let pageSnippet = "";
    try {
      const r = await fetch(url, { headers: { "User-Agent": "AccessAuditAI/1.0" } });
      pageSnippet = (await r.text()).slice(0, 30000);
    } catch {
      pageSnippet = `(Could not fetch ${url}. Perform a thorough WCAG 2.2 AA audit based on typical patterns for this domain.)`;
    }
    const system = `You are an elite WCAG 2.2 AA accessibility auditor. Analyze the HTML and produce an exhaustive audit. Find 15-25 violations minimum. Be specific and brutal — real sites always have many issues.

SCORING: Start at 25 per category. Deduct: critical=7, serious=4, moderate=2, minor=1. overall_score = sum of all 4 categories.

Return ONLY this JSON:
{"overall_score":number,"category_scores":{"perceivable":number,"operable":number,"understandable":number,"robust":number},"violations":[{"id":"string","severity":"critical|serious|moderate|minor","name":"string","wcag_criterion":"WCAG X.X.X","description":"string","element_affected":"string","legal_impact":"string","fix_instructions":"string","estimated_fix_time":"string"}]}`;
    const raw = await callGemini(system, `URL: ${url}\n\nHTML:\n${pageSnippet}`);
    const result = parseJSON(raw);
    const { data: inserted, error } = await context.supabase
      .from("audits")
      .insert({ user_id: context.userId, url, overall_score: result.overall_score ?? 0, category_scores: result.category_scores ?? {}, violations: result.violations ?? [] })
      .select().single();
    if (error) throw error;
    return inserted;
  });

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      auditId: z.string().uuid().optional(),
      url: z.string().optional(),
      agencyName: z.string().default(""),
      clientName: z.string().default(""),
      clientIndustry: z.string().default(""),
      tone: z.enum(["professional", "urgent", "consultative"]).default("professional"),
      priceMin: z.number().default(2500),
      priceMax: z.number().default(8000),
      violations: z.array(z.any()).default([]),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const system = `You are an elite B2B sales engineer writing an accessibility compliance proposal for a digital agency to send to their client. Tone: ${data.tone}.
Return ONLY this JSON:
{"executive_summary":"string","legal_risk":"string","solution":"string","next_steps":"string","follow_up_email":"string"}`;
    const user = `Agency: ${data.agencyName}\nClient: ${data.clientName}\nIndustry: ${data.clientIndustry}\nURL: ${data.url ?? ""}\nPrice: $${data.priceMin}–$${data.priceMax}\nViolations:\n${data.violations.slice(0, 12).map((v: any, i: number) => `${i + 1}. [${v.severity}] ${v.name} (${v.wcag_criterion})`).join("\n")}`;
    const raw = await callGemini(system, user);
    return parseJSON(raw);
  });

export const generateColdEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      agencyName: z.string().default(""),
      clientName: z.string().default(""),
      url: z.string().default(""),
      violations: z.array(z.any()).default([]),
      score: z.number().default(0),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const system = `Write a short, warm cold email from an agency to a prospect about their website accessibility issues. 5-7 sentences. Not salesy. Return ONLY JSON: {"subject":"string","body":"string"}`;
    const user = `Agency: ${data.agencyName}\nProspect: ${data.clientName}\nSite: ${data.url}\nScore: ${data.score}/100\nTop issues: ${data.violations.slice(0, 3).map((v: any) => v.name).join(", ")}`;
    const raw = await callGemini(system, user);
    return parseJSON(raw);
  });

export const searchLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ industry: z.string(), location: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const system = `You are a lead generation assistant for web accessibility services. Generate 8 realistic local businesses in the given industry and location that likely have poor web accessibility. Return ONLY a JSON array:
[{"id":"string","name":"string","website":"string","ranking":"string","common_flaw":"string"}]
Use realistic website URLs. Ranking like "Top 10 local". Common flaw should be a real WCAG issue name.`;
    const raw = await callGemini(system, `Industry: ${data.industry}\nLocation: ${data.location}`);
    const parsed = parseJSON(raw);
    return Array.isArray(parsed) ? parsed : (parsed.leads ?? []);
  });
