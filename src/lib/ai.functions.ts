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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please retry shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "{}";
}

function parseJSON(s: string) {
  try { return JSON.parse(s); }
  catch {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

export const runAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { url } = data;
    // Fetch page content (best-effort)
    let pageSnippet = "";
    try {
      const r = await fetch(url, { headers: { "User-Agent": "AccessAuditAI/1.0" } });
      const html = await r.text();
      pageSnippet = html.slice(0, 25000);
    } catch {
      pageSnippet = `(Could not fetch ${url} directly. Analyze typical accessibility issues for this URL based on its domain and structure.)`;
    }

    const system = `You are a WCAG 2.1 AA accessibility expert performing a website audit. Analyze the provided HTML and produce a structured audit JSON.

Return JSON with EXACTLY this schema:
{
  "overall_score": number 0-100,
  "category_scores": { "perceivable": 0-25, "operable": 0-25, "understandable": 0-25, "robust": 0-25 },
  "violations": [
    {
      "id": "string-id",
      "severity": "critical" | "serious" | "moderate" | "minor",
      "name": "short title",
      "wcag_criterion": "WCAG X.X.X",
      "description": "one-line plain English",
      "element_affected": "what element/area",
      "legal_impact": "why it matters legally (EU EAA, ADA, AODA, Equality Act)",
      "fix_instructions": "how to fix in plain English"
    }
  ]
}

Be specific and realistic. Aim for 6-12 violations across severities. The overall_score should equal the sum of category_scores * 4.`;

    const user = `URL: ${url}\n\nHTML snippet:\n${pageSnippet}`;
    const raw = await callGemini(system, user);
    const result = parseJSON(raw);

    // Persist
    const { data: inserted, error } = await context.supabase
      .from("audits")
      .insert({
        user_id: context.userId,
        url,
        overall_score: result.overall_score ?? 0,
        category_scores: result.category_scores ?? {},
        violations: result.violations ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
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
    const system = `You write client-facing proposals for web design agencies. Output strictly JSON:
{
  "executive_summary": "2-3 sentences",
  "legal_risk": "1 paragraph in plain English covering EAA/ADA/AODA/Equality Act",
  "solution": "1 paragraph describing what the agency will fix",
  "next_steps": "1 short paragraph CTA"
}
Tone: ${data.tone}.`;
    const user = `Agency: ${data.agencyName}
Client: ${data.clientName}
Client industry: ${data.clientIndustry}
Audit URL: ${data.url ?? ""}
Price range: $${data.priceMin} – $${data.priceMax}
Violations (${data.violations.length}):
${data.violations.slice(0, 12).map((v: any, i: number) => `${i + 1}. [${v.severity}] ${v.name} (${v.wcag_criterion}) — ${v.description}`).join("\n")}`;

    const raw = await callGemini(system, user);
    return parseJSON(raw);
  });

export const generateColdEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      agencyName: z.string().default(""),
      clientName: z.string().default(""),
      url: z.string().default(""),
      violations: z.array(z.any()).default([]),
      score: z.number().default(0),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const system = `Write a short cold email from an agency to a prospect. Tone: warm, helpful, not salesy. 5-7 sentences max. Return JSON: { "subject": string, "body": string }.`;
    const user = `Agency: ${data.agencyName}
Prospect: ${data.clientName}
Their site: ${data.url}
Compliance score: ${data.score}/100
Top issues: ${data.violations.slice(0, 3).map((v: any) => v.name).join(", ")}`;
    const raw = await callGemini(system, user);
    return parseJSON(raw);
  });
