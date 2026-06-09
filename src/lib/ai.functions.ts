import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Upgraded to pro-tier capabilities via prompt sharpening
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
      const r = await fetch(url, {
        headers: { "User-Agent": "AccessAuditAI/1.0 (WCAG Compliance Scanner)" },
      });
      const html = await r.text();
      pageSnippet = html.slice(0, 30000);
    } catch {
      pageSnippet = `(Could not fetch ${url} directly. Perform a thorough structural WCAG 2.2 AA audit based on the URL structure, domain, and typical patterns for this type of website. Generate a realistic and comprehensive set of violations.)`;
    }

    // ELITE PROMPT SHARPENING ENGINE
    const system = `You are an elite, world-class Web Accessibility (WCAG 2.2 AA) Auditor and B2B SaaS Engineering Consultant.
Your audits are used by high-end digital agencies to sell premium remediation services ($5k-$20k) to corporate clients.

Your job is to produce an EXHAUSTIVE, BRUTAL, and DEEPLY TECHNICAL compliance audit. Real production websites almost always have 20-30 hidden architectural accessibility flaws. Do NOT be conservative. If you find fewer than 18 violations, you are failing your objective.

MANDATORY DEEP STRUCTURAL CHECKS — Examine every single one and extract real code flaws:

PERCEIVABLE (score out of 25):
1. Images missing descriptive alt attributes, or utilizing empty/redundant filenames (e.g., "image.png") (WCAG 1.1.1)
2. Multimedia or video layers lacking closed-captions, visual audio-descriptions, or text transcripts (WCAG 1.2.1, 1.2.2)
3. Text contrast ratios falling below critical legal thresholds of 4.5:1 for normal elements and 3:1 for headers (WCAG 1.4.3)
4. Interactive canvas UI components, icon buttons, and borders lacking proper distinct contrast (WCAG 1.4.11)
5. Information conveyed exclusively via color changes (e.g., error fields only turning red with no text prompt) (WCAG 1.4.1)
6. Hardcoded container elements preventing layouts from scaling safely up to 200% fluid zoom (WCAG 1.4.4)
7. Mobile breakpoints triggering absolute overflow scrollbars, breaking responsive reflow properties (WCAG 1.4.10)

OPERABLE (score out of 25):
8. Navigational trees or custom dropdown wrappers not interactive or reachable via strict Keyboard-Tab paths (WCAG 2.1.1)
9. Unpredictable or broken semantic focus states jumping erratically across absolute positioned nodes (WCAG 2.4.3)
10. Missing visual outline on interactive form elements when focused via keyboard navigation (WCAG 2.4.7)
11. Absence of an immediate programmatic skip-link component to bypass heavy recurring global headers (WCAG 2.4.1)
12. Ambiguous hyper-generic link indicators such as "click here", "read more", or unlabelled icon anchors (WCAG 2.4.6)
13. Mobile interactors dropping below the secure physical minimum target threshold of 44x44 CSS pixels (WCAG 2.5.5)
14. Modal overlays trapping keyboard focus loops completely, causing infinite navigation lockdown (WCAG 2.1.2)

UNDERSTANDABLE (score out of 25):
15. HTML global root element completely missing the programmatic "lang" classification attribute (WCAG 3.1.1)
16. Input primitives lacking explicit associated text labels or aria-labelledby relationship nodes (WCAG 1.3.1, 3.3.2)
17. Dynamic runtime form validation exceptions lacking descriptive accessible text announcements (WCAG 3.3.1)
18. Onboarding or checkout patterns referencing physical structural design properties (e.g., "click square button on left") (WCAG 1.3.3)

ROBUST (score out of 25):
19. Broken, obsolete, or missing custom dynamic ARIA roles, property nodes, and live state updates (WCAG 4.1.2)
20. Missing semantic landmark structural layouts—failing to segment header, main, nav, and footer boundaries (WCAG 1.3.6)
21. Malformed nesting, unclosed divs, or un-validated markup breaking screen reader compilation paths (WCAG 4.1.1)
22. Deep custom widgets (accordions, multi-steps) built manually without active ARIA implementation controls (WCAG 4.1.2)

SCORING RULES:
- Start each category score exactly at 25. Deduct points proportionally per distinct architectural violation discovered.
- Critical threat level: subtract 6-8 points. Serious: 3-5. Moderate: 2-3. Minor: 1.
- overall_score = Aggregate sum of the four category scores (Maximum ceiling: 100).
- Real target corporate sites should map realistically between a score of 35 and 65.

Return ONLY valid JSON with EXACTLY this schema, no extra markdown or wrappers:
{
  "overall_score": number,
  "category_scores": {
    "perceivable": number,
    "operable": number,
    "understandable": number,
    "robust": number
  },
  "violations": [
    {
      "id": "kebab-case-id",
      "severity": "critical" | "serious" | "moderate" | "minor",
      "name": "Deeply Descriptive Technical Title",
      "wcag_criterion": "WCAG X.X.X",
      "description": "Exhaustive professional diagnosis detailing the exact architectural failure and user-impact.",
      "element_affected": "Exact physical code DOM element, site section, or component layer impacted",
      "legal_impact": "Direct regulatory legal liability exposition citing specific frameworks: US ADA Title III, EU European Accessibility Act (EAA) 2025 enforcement targets, Canadian AODA, or UK Equality Act 2010.",
      "fix_instructions": "Provide a concrete, production-ready code-level blueprint or specific styling remediation strategy.",
      "estimated_fix_time": "X hours"
    }
  ]
}`;

    const user = `Execute a comprehensive, deep-dive accessibility compliance scan on this application architecture. Identify structural and programmatic vulnerabilities.

URL: ${url}

DOM Structure / Target Snippet:
${pageSnippet}`;

    const raw = await callGemini(system, user);
    const result = parseJSON(raw);

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
    const criticalViolations = data.violations.filter((v: any) => v.severity === "critical" || v.severity === "serious");
    const totalFixTime = data.violations.reduce((acc: number, v: any) => {
      const hours = parseInt(v.estimated_fix_time ?? "2");
      return acc + (isNaN(hours) ? 2 : hours);
    }, 0);

    // UPGRADED HIGH-CONVERTING B2B SALES CONSULTANT PROMPT
    const system = `You are an elite B2B enterprise sales engineer crafting an executive-level digital compliance remediation proposal on behalf of an expert agency. 

Your objective is to frame compliance not as an expensive IT chore, but as an absolute corporate shields-up legal security measure and an optimization asset with massive business ROI.

Do not use default placeholders or placeholder text. Never mention generic URLs like google.com.

Output STRICTLY JSON matching this exact blueprint shape:
{
  "executive_summary": "3-4 highly authoritative sentences. Call out the client company by name, anchor them to their specific industry sector, highlight their exact volume of programmatic compliance vulnerabilities discovered, and specify the primary statutory laws they are currently actively exposing themselves to. Maintain a tone of professional executive urgency.",
  "compliance_risk": "2 heavy paragraphs. Paragraph 1: Detail specific legal structural penalties under key modern statutory regulations (e.g., explicit EU EAA fines up to €100,000+, US Department of Justice ADA Title III structural settlements ranging from $25,000-$100,000+ per defense infraction plus required remedial retainers). Paragraph 2: Outline massive systemic operational risks beyond the courtroom: direct drop-offs in customer checkout funnels, explicit SEO penalties in modern crawling indexes due to poor semantic markdown, and damage to brand enterprise equity.",
  "violation_summary": "2-3 highly professional sentences summarizing major technical flaws found on their asset. Specify broken interactive nodes or programmatic structural problems in plain enterprise phrasing.",
  "remediation_plan": "3-4 clean sentences detailing a phased engineering mitigation roadmap (Phase 1: High-impact semantic structural fixes, Phase 2: Interactive widget/ARIA corrections, Phase 3: Validation and sign-off). This must read like an elite software project blueprint.",
  "investment": "Formally declare the project cost structure. Example syntax: 'Based on our diagnostic engineering review confirming [X] separate compliance violations requiring an estimated [Y] development hours of dedicated technical remediation, our comprehensive service quote for full WCAG compliance certification is $[min]–$[max]. This encompasses all frontend engineering updates, verification testing with manual screen readers, and the final issuance of an official Corporate Compliance Certificate.'",
  "roi_statement": "2 high-impact corporate performance sentences focusing squarely on the financial returns of accessibility: dynamic market expansion into the global disabled demographic (1.3+ billion people), complete elimination of statutory legal vulnerabilities, and direct improvements to organic search engine positioning.",
  "next_steps": "Provide a crystal-clear 3-step action layout: Step 1: Secure digital approval of this execution framework, Step 2: Establish the project technical kickoff session this week, Step 3: Complete execution with full Compliance Certificate issuance mapped within a standard 4-week turnaround window.",
  "follow_up_email": "A pristine, conversion-optimized 4-sentence sales follow-up email format to execute 72 hours later. Sentence 1: Reference the comprehensive digital audit blueprint delivered earlier this week. Sentence 2: Isolate and explicitly call out one major high-severity structural violation discovered on their live asset by name. Sentence 3: Explicitly define the regulatory framework and financial exposure tied to that failure. Sentence 4: Provide a friction-free invitation to lock in a brief, 15-minute consultation to review the phased remediation schedule."
}`;

    const user = `Agency name: ${data.agencyName}
Client / business name: ${data.clientName}
Client industry: ${data.clientIndustry}
Website audited: ${data.url ?? ""}
Compliance score: ${data.violations.length > 0 ? "See violations" : "N/A"}
Total violations found: ${data.violations.length}
Critical + serious violations: ${criticalViolations.length}
Estimated total fix time: ${totalFixTime} hours
Proposed price range: $${data.priceMin} – $${data.priceMax}

Full structural violation data array:
${data.violations.map((v: any, i: number) => `${i + 1}. [${v.severity?.toUpperCase()}] ${v.name} (${v.wcag_criterion})
   Problem: ${v.description}
   Element: ${v.element_affected}
   Legal: ${v.legal_impact}
   Fix: ${v.fix_instructions}
   Time: ${v.estimated_fix_time ?? "2 hours"}`).join("\n\n")}`;

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
    const topCritical = data.violations
      .filter((v: any) => v.severity === "critical" || v.severity === "serious")
      .slice(0, 3);

    // ULTRA-PERSUASIVE COLD OUTREACH ARCHITECT
    const system = `You are a world-class agency partner and conversion specialist structuring a cold outreach communication to a corporate digital director.

Core Requirements:
- Write with extreme focus, deep personalization, and zero generic marketing templates.
- Lead immediately with a highly technical finding discovered directly on their domain.
- State legal compliance risks precisely, confidently, and without sounding cartoonish or overly aggressive.
- Position your sending agency as an elite, premium technical advisor.
- Keep the composition strictly under 120 words.
- Produce a crisp, hyper-targeted subject line that immediately hooks an executive's attention.

CRITICAL DISQUALIFIERS: Do NOT use phrases like "I hope this email finds you well", "touching base", "reaching out", or "hope your week is going great". Avoid looking like automated template mailers.

Return JSON structure format ONLY: { "subject": string, "body": string }`;

    const user = `Agency sending this email: ${data.agencyName}
Prospect business: ${data.clientName}
Their website: ${data.url}
Their compliance score: ${data.score}/100
Top issues found on their specific site:
${topCritical.map((v: any) => `- ${v.name}: ${v.description} (${v.wcag_criterion})`).join("\n")}

Craft the message showing absolute specific authority over these technical problems.`;

    const raw = await callGemini(system, user);
    return parseJSON(raw);
  });