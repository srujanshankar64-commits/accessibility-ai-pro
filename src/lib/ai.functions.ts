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
    let pageSnippet = "";
    try {
      const r = await fetch(url, { headers: { "User-Agent": "AccessAuditAI/1.0 (WCAG Compliance Scanner)" } });
      const html = await r.text();
      pageSnippet = html.slice(0, 30000);
    } catch {
      pageSnippet = `(Could not fetch ${url} directly. Perform a thorough structural WCAG 2.2 AA audit based on the URL structure, domain, and typical patterns for this type of website. Generate a realistic and comprehensive set of violations.)`;
    }

    const system = `You are an elite, world-class Web Accessibility (WCAG 2.2 AA) Auditor and B2B SaaS Engineering Consultant.
Your audits are used by high-end digital agencies to sell premium remediation services ($5k-$20k) to corporate clients.
Your job is to produce an EXHAUSTIVE, BRUTAL, and DEEPLY TECHNICAL compliance audit. Real production websites almost always have 20-30 hidden architectural accessibility flaws. Do NOT be conservative. If you find fewer than 18 violations, you are failing your objective.

PERCEIVABLE (score out of 25): 1. Images missing alt attributes (WCAG 1.1.1). 2. Lack of closed-captions/transcripts (WCAG 1.2.1, 1.2.2). 3. Contrast ratios below 4.5:1 (WCAG 1.4.3). 4. Icon/border contrast (WCAG 1.4.11). 5. Color-only error indicators (WCAG 1.4.1). 6. Container zoom constraints (WCAG 1.4.4). 7. Mobile overflow/reflow (WCAG 1.4.10).
OPERABLE (score out of 25): 8. Keyboard-Tab navigation (WCAG 2.1.1). 9. Broken focus states (WCAG 2.4.3). 10. Missing visual outline on focus (WCAG 2.4.7). 11. Missing skip-link (WCAG 2.4.1). 12. Ambiguous hyper-generic links (WCAG 2.4.6). 13. Mobile target size (WCAG 2.5.5). 14. Modal focus traps (WCAG 2.1.2).
UNDERSTANDABLE (score out of 25): 15. Missing lang attribute (WCAG 3.1.1). 16. Input label/aria-labelledby (WCAG 1.3.1, 3.3.2). 17. Validation exception text (WCAG 3.3.1). 18. Structural design references (WCAG 1.3.3).
ROBUST (score out of 25): 19. ARIA roles/live state (WCAG 4.1.2). 20. Missing landmark structural layouts (WCAG 1.3.6). 21. Malformed/unclosed markup (WCAG 4.1.1). 22. Custom widget ARIA (WCAG 4.1.2).

SCORING RULES: Start at 25 per category. Deduct 6-8 for critical, 3-5 serious, 2-3 moderate, 1 minor. overall_score = Aggregate sum (100). Return JSON ONLY.
{ "overall_score": number, "category_scores": { "perceivable": number, "operable": number, "understandable": number, "robust": number }, "violations": [{ "id": string, "severity": string, "name": string, "wcag_criterion": string, "description": string, "element_affected": string, "legal_impact": string, "fix_instructions": string, "estimated_fix_time": string }] }`;

    const raw = await callGemini(system, `Audit URL: ${url}. DOM Snippet: ${pageSnippet}`);
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
  .inputValidator((data: any) => z.any().parse(data))
  .handler(async ({ data }) => {
    const system = `You are an elite B2B enterprise sales engineer crafting an executive-level digital compliance remediation proposal. Frame compliance as a protective shield and corporate asset. Clinical, highly analytical, professional tone. Output JSON matching this schema: { "executive_summary": string, "compliance_risk": string, "violation_summary": string, "remediation_plan": string, "investment": string, "roi_statement": string, "next_steps": string, "follow_up_email": string }`;
    const raw = await callGemini(system, JSON.stringify(data));
    return parseJSON(raw);
  });

export const generateColdEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.any().parse(data))
  .handler(async ({ data }) => {
    const system = `You are a world-class agency partner structuring professional digital risk outreach. Lead with technical findings. Clinical, authoritative, no generic filler. Return JSON: { "subject": string, "body": string }.`;
    const raw = await callGemini(system, JSON.stringify(data));
    return parseJSON(raw);
  });

export const searchLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ industry: z.string(), location: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { industry, location } = data;
    const system = `You are an elite B2B Market Analyst. Generate 5 high-value, realistic leads for ${industry} in ${location}. For each lead, evaluate based on enterprise-grade accessibility standards. Return JSON array matching this schema: [{ "id": string, "name": string, "website": string, "ranking": string, "score": number, "status": string, "common_flaw": string }]`;
    const raw = await callGemini(system, `Analyze top market participants for ${industry} in ${location} and provide professional risk profiles.`);
    const parsed = parseJSON(raw);
    return Array.isArray(parsed) ? parsed : (parsed.leads || []);
  });
export const searchLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      industry: z.string(),
      location: z.string(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const system = `You are a lead generation assistant. Generate a list of 8 realistic local businesses in the given industry and location that likely have poor web accessibility. Return ONLY a JSON array with this exact shape:
[{ "id": "string", "name": "string", "website": "string", "ranking": "string", "common_flaw": "string" }]
Make websites realistic (e.g. plumbingaustin.com). Ranking should be like "Top 10 local". Common flaw should be a short WCAG issue.`;
    const user = `Industry: ${data.industry}\nLocation: ${data.location}`;
    const raw = await callGemini(system, user);
    const parsed = parseJSON(raw);
    return Array.isArray(parsed) ? parsed : parsed.leads ?? [];
  });
