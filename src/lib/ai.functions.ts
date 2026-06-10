import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getPlan, TIER, canRunAudit, PLAN_PRICES } from "@/lib/tier.utils";

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

async function getUserSettings(supabase: any, userId: string) {
  const { data } = await supabase
    .from("settings")
    .select("plan, audits_used, audits_limit, agency_name, agency_logo_url, brand_color, gemini_api_key")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export const runAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { url } = data;
    const settings = await getUserSettings(context.supabase, context.userId);
   
    const usedThisMonth = settings?.audits_used ?? 0;
const plan = getPlan(settings?.plan, 'srujanshankar64@gmail.com');
    if (!canRunAudit(plan, usedThisMonth)) {
      throw new Error(
        plan === "free"
          ? `You have used all ${TIER.free.audits} free audits this month. Upgrade to Starter ($${PLAN_PRICES.starter}/mo) for ${TIER.starter.audits} audits.`
          : plan === "starter"
          ? `You have used all ${TIER.starter.audits} audits this month. Upgrade to Agency ($${PLAN_PRICES.agency}/mo) for unlimited audits.`
          : "Monthly audit limit reached. Please contact support."
      );
    }

    let pageSnippet = "";
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "AccessAuditAI/1.0 (WCAG Compliance Scanner)" },
      });
      const html = await r.text();
      pageSnippet = html.slice(0, 30000);
    } catch {
      pageSnippet = `(Could not fetch ${url} directly. Perform a thorough theoretical WCAG 2.1 AA audit based on the URL structure and typical patterns for this type of website.)`;
    }

    const includeCodeFixes = TIER[plan].codeFixes;

    const system = `You are a senior WCAG 2.1 AA accessibility auditor with 10 years of experience. Your audits are used by digital agencies to sell remediation services to corporate entities.

Your job is to produce an EXHAUSTIVE and REALISTIC audit. You MUST find and report every violation present. Do NOT be conservative. Real websites almost always have 15-25 violations. If you find fewer than 12, you are not looking hard enough.

MANDATORY CHECKS:

PERCEIVABLE (score out of 25):
1. Images missing alt attributes or with empty/meaningless alt text (WCAG 1.1.1)
2. Videos or audio missing captions or transcripts (WCAG 1.2.1, 1.2.2)
3. Text with insufficient color contrast ratio below 4.5:1 (WCAG 1.4.3)
4. UI components with insufficient contrast (WCAG 1.4.11)
5. Information conveyed by color alone (WCAG 1.4.1)
6. Text that cannot be resized up to 200% (WCAG 1.4.4)
7. Content that breaks on small viewports (WCAG 1.4.10)
8. Missing prefers-reduced-motion support (WCAG 2.3.3)

OPERABLE (score out of 25):
9. Interactive elements not reachable by keyboard (WCAG 2.1.1)
10. Illogical focus order (WCAG 2.4.3)
11. Missing or weak focus indicator (WCAG 2.4.7)
12. No skip navigation link (WCAG 2.4.1)
13. Links with vague text like "click here" or "read more" (WCAG 2.4.6)
14. Touch targets smaller than 44x44px (WCAG 2.5.5)
15. Keyboard traps (WCAG 2.1.2)
16. Auto-playing media with no pause control (WCAG 2.2.2)
17. Session timeouts with no warning (WCAG 2.2.1)

UNDERSTANDABLE (score out of 25):
18. Missing lang attribute on HTML element (WCAG 3.1.1)
19. Form inputs without associated labels (WCAG 1.3.1, 3.3.2)
20. Form validation errors not described in text (WCAG 3.3.1)
21. Instructions relying solely on sensory characteristics (WCAG 1.3.3)
22. Inconsistent navigation across pages (WCAG 3.2.3)
23. Unexplained abbreviations or jargon (WCAG 3.1.5)

ROBUST (score out of 25):
24. Missing or incorrect ARIA roles (WCAG 4.1.2)
25. Missing ARIA landmark regions (WCAG 1.3.6)
26. Broken or invalid HTML structure (WCAG 4.1.1)
27. Missing or empty page title (WCAG 2.4.2)
28. Incorrect heading hierarchy (WCAG 1.3.1)
29. Custom widgets without keyboard or ARIA support (WCAG 4.1.2)
30. iFrames without title attributes (WCAG 4.1.2)

SCORING RULES:
- Start each category at 25. Subtract per violation: Critical = 6-8pts, Serious = 3-5pts, Moderate = 2-3pts, Minor = 1pt.
- overall_score = sum of all four category scores (max 100).
- Typical real website scores 35-65. Only excellent sites score above 80.

` + (includeCodeFixes
  ? `For each violation, include a "code_fix" field with the exact HTML/CSS/JavaScript code snippet that fixes the issue. Make it copy-paste ready for a developer.`
  : `Do NOT include a "code_fix" field in the output.`) + `

Return ONLY valid JSON with EXACTLY this schema:
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
      "name": "Short descriptive title",
      "wcag_criterion": "WCAG X.X.X",
      "description": "Plain English explanation of the exact problem",
      "element_affected": "Specific element or area affected",
      "legal_impact": "Specific legal exposure under EU EAA, ADA, AODA, UK Equality Act",
      "fix_instructions": "Concrete plain-English fix description",
      "estimated_fix_time": "X hours"` + (includeCodeFixes ? `,
      "code_fix": "exact code snippet"` : "") + `
    }
  ]
}`;

    const user = `Audit this website for WCAG 2.1 AA compliance. Be exhaustive. Find every violation.\n\nURL: ${url}\n\nHTML content:\n${pageSnippet}`;

    const raw = await callGemini(system, user);
    const result = parseJSON(raw);

    const violationLimit = TIER[plan].violations;
    const allViolations = result.violations ?? [];
    const limitedViolations = plan === "free"
      ? allViolations.slice(0, violationLimit)
      : allViolations;

    await context.supabase
      .from("settings")
      .update({ audits_used: usedThisMonth + 1 })
      .eq("user_id", context.userId);

    const { data: inserted, error } = await context.supabase
      .from("audits")
      .insert({
        user_id: context.userId,
        url,
        overall_score: result.overall_score ?? 0,
        category_scores: result.category_scores ?? {},
        violations: limitedViolations,
      })
      .select()
      .single();
    if (error) throw error;

    return {
      ...inserted,
      plan,
      totalViolationsFound: allViolations.length,
      violationsShown: limitedViolations.length,
      isLimited: plan === "free" && allViolations.length > violationLimit,
    };
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
  .handler(async ({ data, context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);
    const plan = getPlan(settings?.plan, 'srujanshankar64@gmail.com');

    if (!TIER[plan].proposals) {
      throw new Error(`Upgrade to Starter ($${PLAN_PRICES.starter}/mo) to generate client proposals.`);
    }

    const criticalViolations = data.violations.filter(
      (v: any) => v.severity === "critical" || v.severity === "serious"
    );
    const totalFixTime = data.violations.reduce((acc: number, v: any) => {
      const hours = parseInt(v.estimated_fix_time ?? "2");
      return acc + (isNaN(hours) ? 2 : hours);
    }, 0);

    const system = `You are a senior B2B sales consultant writing a corporate compliance proposal on behalf of a digital agency.

The proposal must:
1. Open with an authoritative statement of the exact compliance liability the client inherits right now.
2. Cross-reference specific legal mandates: EU Accessibility Act, US ADA Title II, UK Equality Act.
3. Present violations as a prioritized risk mitigation structure.
4. Frame remediation as high-value infrastructure stability with protective ROI.
5. Present pricing as a professional engineering project quote.
6. Close with a clear corporate action plan.

Tone: ${data.tone}. Write for a business executive, not a junior developer. Keep layout sleek, ultra-clean, and urgent.

Output STRICTLY JSON:
{
  "executive_summary": "3-4 sentences. Name the client, reference their industry, state violations found, name laws violated.",
  "compliance_risk": "2 paragraphs. Legal exposure with real penalty ranges. Business risk beyond legal.",
  "violation_summary": "2-3 sentences summarising the most critical findings in plain English.",
  "remediation_plan": "3-4 sentences describing the SPECIFIC technical work to be done based on the violations found. Name actual fixes like 'add alt attributes to all images', 'implement skip navigation link', 'add ARIA landmark regions'. State the outcome: full WCAG 2.1 AA compliance within 4 weeks.",
  "investment": "Professional price range statement referencing the estimated work hours.",
  "roi_statement": "2 sentences on ROI — avoiding lawsuit costs, reaching 1.3 billion people with disabilities, improved SEO.",
  "next_steps": "3-step CTA: approve proposal, kickoff call, compliance certificate in 4 weeks.",
  "follow_up_email": "4-sentence follow-up email sent 3 days later. Sentence 1: reference the specific audit report sent for their website by name. Sentence 2: name ONE specific critical violation found on their actual site. Sentence 3: state the exact legal risk and fine amount. Sentence 4: invite them to a 15-minute call. NEVER use 'I hope this email finds you well', 'touching base', 'reaching out', or any filler phrases. Sound like a real human who actually audited their site."
}`;

    const user = `Agency: ${data.agencyName}
Client: ${data.clientName}
Industry: ${data.clientIndustry}
Website: ${data.url ?? ""}
Violations: ${data.violations.length} total, ${criticalViolations.length} critical/serious
Estimated fix time: ${totalFixTime} hours
Price range: $${data.priceMin} - $${data.priceMax}

Violations:
${data.violations.map((v: any, i: number) => `${i + 1}. [${v.severity?.toUpperCase()}] ${v.name} (${v.wcag_criterion}) - ${v.description} | Fix: ${v.fix_instructions} | Time: ${v.estimated_fix_time ?? "2 hours"}`).join("\n")}`;

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
  .handler(async ({ data, context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);
    const plan = getPlan(settings?.plan, 'srujanshankar64@gmail.com');

    if (!TIER[plan].coldEmail) {
      throw new Error(`Upgrade to Starter ($${PLAN_PRICES.starter}/mo) to generate cold email drafts.`);
    }

    const topCritical = data.violations
      .filter((v: any) => v.severity === "critical" || v.severity === "serious")
      .slice(0, 3);

    const system = `You are an elite enterprise account manager generating highly researched cold outreach text for a corporate target.

The layout must:
- Instantly demonstrate tailored research, not automated template phrasing
- Anchor on a definitive infrastructure fault identified from their real web framework
- Reference statutory liabilities directly and objectively
- Total length under 120 words
- Subject header custom-mapped to their domain profile

Return JSON: { "subject": string, "body": string }
Do NOT include conversational filler like "I hope this email finds you well", "touching base", or "reaching out".`;

    const user = `Agency: ${data.agencyName}
Prospect: ${data.clientName}
Website: ${data.url}
Compliance score: ${data.score}/100
Top issues:
${topCritical.map((v: any) => `- ${v.name}: ${v.description} (${v.wcag_criterion})`).join("\n")}`;

    const raw = await callGemini(system, user);
    return parseJSON(raw);
  });

export const generateCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      auditId: z.string().uuid(),
      url: z.string(),
      score: z.number(),
      agencyName: z.string().default(""),
      clientName: z.string().default(""),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);
    const plan = getPlan(settings?.plan, 'srujanshankar64@gmail.com');

    if (!TIER[plan].certificate) {
      throw new Error(`Upgrade to Agency ($${PLAN_PRICES.agency}/mo) to generate compliance certificates.`);
    }

    return {
      certificateNumber: `WCAG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      issuedTo: data.clientName || data.url,
      issuedBy: data.agencyName || "AccessAudit AI",
      website: data.url,
      score: data.score,
      standard: "WCAG 2.1 Level AA",
      issuedDate: new Date().toISOString().split("T")[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      auditId: data.auditId,
    };
  });

export const getPlanStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);
    const plan = getPlan(settings?.plan, 'srujanshankar64@gmail.com');
    const used = settings?.audits_used ?? 0;
    const tier = TIER[plan];

    return {
      plan,
      used,
      limit: tier.audits === Infinity ? "Unlimited" : tier.audits,
      features: tier,
      agencyName: settings?.agency_name ?? "",
      agencyLogoUrl: settings?.agency_logo_url ?? null,
      brandColor: settings?.brand_color ?? "#6E56CF",
    };
  });
export const searchLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ industry: z.string(), location: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { industry, location } = data;
    let realBusinesses: any[] = [];
    try {
      const query = `[out:json][timeout:25];area[name="${location}"]->.s;(node["name"]["website"](area.s);way["name"]["website"](area.s););out body 20;`;
      const r = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      const osmData = await r.json();
      realBusinesses = (osmData.elements ?? [])
        .filter((el: any) => el.tags?.website && el.tags?.name)
        .slice(0, 8)
        .map((el: any, i: number) => ({
          id: String(el.id),
          name: el.tags.name,
          website: el.tags.website.startsWith("http") ? el.tags.website : `https://${el.tags.website}`,
          ranking: `Top ${(i + 1) * 5} local`,
          common_flaw: "",
        }));
    } catch { realBusinesses = []; }
    if (realBusinesses.length >= 3) {
      try {
        const system = `For each business in the JSON array, add a realistic common_flaw based on typical WCAG issues for that business type. Return the SAME array with common_flaw filled in. Return ONLY valid JSON array.`;
        const raw = await callGemini(system, JSON.stringify(realBusinesses));
        const parsed = parseJSON(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { return realBusinesses; }
    }
    const system = `Generate 8 realistic local businesses for ${industry} in ${location} with poor web accessibility. Return ONLY a JSON array: [{"id":"string","name":"string","website":"string","ranking":"string","common_flaw":"string"}]`;
    const raw = await callGemini(system, `Industry: ${industry}\nLocation: ${location}`);
    const parsed = parseJSON(raw);
    return Array.isArray(parsed) ? parsed : (parsed.leads ?? []);
  });
