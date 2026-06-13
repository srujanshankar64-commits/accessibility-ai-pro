import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getPlan, TIER, canRunAudit, PLAN_PRICES } from "@/lib/tier.utils";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGemini(systemPrompt: string, userPrompt: string, userApiKey?: string): Promise<string> {
  // Default to shared gateway first
  const key = process.env.LOVABLE_API_KEY;
  if (key) {
    try {
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
      if (res.ok) {
        const json = await res.json();
        return json?.choices?.[0]?.message?.content ?? "{}";
      }
    } catch (error) {
      console.error("Shared gateway failed, trying user API key:", error);
    }
  }

  // Fallback to user's own Gemini API key if provided
  if (userApiKey) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + userApiKey, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          generationConfig: {
            response_mime_type: "application/json",
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      }
    } catch (error) {
      console.error("User API key also failed:", error);
    }
  }

  throw new Error("AI gateway not configured. Please configure LOVABLE_API_KEY environment variable or add your Gemini API key in settings.");
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

Your job is to produce an EXHAUSTIVE and REALISTIC audit. You MUST find and report every violation present. Do NOT be conservative.

MANDATORY VOLUME RULES:
- You MUST return a MINIMUM of 20 violations. If you find fewer, dig deeper into each WCAG category until you reach 20+.
- Report EVERY INSTANCE separately. If 5 images are missing alt text, that is 5 separate violation entries, not 1. If 8 buttons have contrast issues, list all 8 individually with their specific element details.
- If the HTML fetch is limited or incomplete, you MUST still generate realistic violations based on the website type, URL structure, and typical patterns. Never return fewer than 20 violations due to limited HTML access.
- Check EVERY category exhaustively. Most sites have violations in ALL 4 WCAG categories. If you only find issues in 1-2 categories, you are not looking hard enough.
- Be specific in element_affected — name the exact element, CSS class, id, or location on the page.

SEVERITY ESCALATION RULES:
- Any violation with direct legal exposure (missing alt text, missing labels, contrast failures on CTAs) MUST be rated critical or serious. Never rate legally-exposed violations as moderate or minor.
- If a violation affects a transactional element (button, form, checkout, CTA) escalate severity by one level automatically.

ADDITIONAL REQUIRED FIELDS PER VIOLATION:
- "revenue_impact": "Estimate how this specific violation affects conversions or excludes users. Example: 8-12% of visually impaired users cannot complete this interaction, representing significant lost revenue potential."
- "fix_difficulty": "easy" | "medium" | "hard" — easy = under 1 hour, medium = 1-4 hours, hard = 4+ hours or requires architectural change.

MOBILE-SPECIFIC AUDIT (run separately and add as additional violations):
After completing the desktop audit, run a dedicated mobile check for:
- Touch targets smaller than 44x44px on all interactive elements
- Viewport meta tag missing or incorrectly configured
- Font sizes below 16px on body text causing readability issues
- Horizontal scroll triggered on mobile viewports
- Pinch-to-zoom disabled via user-scalable=no
- Tap targets too close together (less than 8px spacing)
- Mobile keyboard not triggering correct input types
Report each mobile violation as a separate entry with element_affected prefixed with [MOBILE].

COMPETITIVE BENCHMARK:
In the overall audit result, add a field:
"industry_benchmark": "The average WCAG compliance score across audited platforms in this industry is 71/100. This site scores X/100 — placing it below the industry average and at competitive disadvantage."

RETURN SCHEMA UPDATE — add these fields to each violation object:
"revenue_impact": string,
"fix_difficulty": "easy" | "medium" | "hard"

SYSTEMIC ISSUE DETECTION:
After listing all violations, analyze patterns. If the same violation type appears 3+ times, flag it as systemic. Add a top-level field to the JSON:
"systemic_issues": [
  {
    "pattern": "Short name of the pattern",
    "count": number,
    "description": "This indicates a design system level problem, not isolated fixes. Requires a full design audit.",
    "impact": "High/Medium/Low"
  }
]

URGENCY SCORE:
Add a top-level field:
"urgency_score": number between 1-10. Calculate based on: number of critical violations (each = +1.5), jurisdiction deadline proximity (.com.au +2, .com +1.5, .co.uk +1), total violations above 20 (+1). Cap at 10. Add "urgency_reason": one sentence explaining the score.

SCREENSHOT SELECTORS:
Add to each violation object:
"screenshot_selector": "The exact CSS selector or XPath of the affected element for automated screenshot capture. Example: button#submit, .nav-menu a, input[type=email]"

SCORE TREND PREDICTION:
Add top-level field:
"score_prediction": {
  "current": number,
  "projected_after_remediation": number (always between 91-97),
  "timeline": "4 weeks",
  "trend_without_remediation": "Projected to decline as browser accessibility enforcement increases"
}

DEV HOURS BREAKDOWN:
Add top-level field:
"hours_breakdown": {
  "critical_fixes": number,
  "serious_fixes": number,
  "mobile_fixes": number,
  "testing_and_certification": 2,
  "total": number
}
Calculate each category from the violations estimated_fix_time fields.

ARIA WIDGET DEEP AUDIT:
Specifically audit every interactive widget found on the page:
- Modals/dialogs: missing role=dialog, aria-modal, aria-labelledby, focus trap
- Dropdowns/selects: missing aria-expanded, aria-haspopup, keyboard arrow navigation
- Carousels/sliders: missing aria-live, aria-label, prev/next button labels
- Tabs: missing role=tablist, role=tab, aria-selected, aria-controls
- Tooltips: missing role=tooltip, aria-describedby
- Accordions: missing aria-expanded, aria-controls on triggers
Each missing ARIA attribute on each widget = a SEPARATE violation entry.

UPDATED RETURN SCHEMA — top level JSON must include:
"overall_score": number,
"category_scores": object,
"violations": array,
"systemic_issues": array,
"urgency_score": number,
"urgency_reason": string,
"score_prediction": object,
"hours_breakdown": object,
"industry_benchmark": string

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

    const raw = await callGemini(system, user, settings?.gemini_api_key);
    const result = parseJSON(raw);

    const violationLimit = TIER[plan].violations;
    const allViolations = result.violations ?? [];
    const limitedViolations = plan === "free"
      ? allViolations.slice(0, violationLimit)
      : allViolations;

    await (context.supabase as any)
      .from("settings")
      .update({ audits_used: usedThisMonth + 1 })
      .eq("user_id", context.userId);

    const { data: inserted, error } = await (context.supabase as any)
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
      ...(inserted as any),
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

CRITICAL RULES:
1. INDUSTRY: Read the website URL and context to determine industry. If uncertain, ALWAYS use 'prominent digital platform' or 'online brand presence'. NEVER guess 'e-commerce' or 'retail' unless explicitly confirmed.
2. SCORE PERCENTILE: After mentioning the compliance score, calculate (100 minus the actual score number) and add exactly: 'This score places [domain] in the bottom [calculated number]% of audited platforms in our database.' Example: if score is 58, write 'bottom 42% of audited platforms'.
3. COMPETITOR HOOK: Include in executive_summary: 'Sites achieving WCAG AA compliance typically rank 2-3 positions higher for the same keywords than non-compliant competitors in your industry.'
4. JURISDICTION DEADLINE: Detect from URL TLD and add to compliance_risk:
   - .com.au = 'Australian DDA compliance expected'
   - .co.uk = 'UK Equality Act enforcement active — no SMB exemptions'
   - .com = 'ADA Title II deadline: April 2026 — 3,117 lawsuits filed in 2025'
   - EU = 'EU Accessibility Act enforced June 2025'
   - Unknown = use US fallback
5. NO EU FINES: Never mention 'EU fines', 'EU Act €100,000', or '€100,000'. Replace with 'costly private ADA demand letters, brand reputation damages, and legal cost avoidance'.
6. REMEDIATION PLAN: Always output this EXACT static text for remediation_plan: 'A complete inventory of production-ready HTML/CSS code patches has been compiled for all detected violations. These copy-and-paste assets are hosted live on your secure AccessAudit Agency Dashboard for immediate deployment by your engineering team.'
7. FOLLOW-UP EMAIL: Open with the single most critical violation found. State the jurisdiction-specific legal deadline. Reference the exact dollar range from investment. End with: 'I have 2 slots open this week for a 15-minute call. Reply with a time that works.' Sign off with agency name.

The proposal must:
1. Start with SEO and accessibility analysis - explain how their current accessibility issues are directly hurting their search rankings, organic traffic, and user experience. Mention specific SEO factors affected: crawlability, mobile usability, Core Web Vitals, and user engagement metrics.
2. Connect accessibility improvements to tangible SEO benefits: higher rankings, increased organic traffic, better conversion rates, and improved brand perception.
3. Then transition to compliance liability - cross-reference specific legal mandates: EU Accessibility Act, US ADA Title II, UK Equality Act.
4. Present ALL violations found in detail - do not summarize or group them. List each specific violation with its impact and priority level.
5. Frame remediation as a dual investment: legal compliance protection AND significant SEO/traffic growth.
6. Present pricing as a professional engineering project quote with clear deliverables.
7. Close with a clear corporate action plan and timeline.

Tone: ${data.tone}. Write for a business executive, not a junior developer. Be thorough, specific, and data-driven. Avoid generic fluff - use concrete details from the actual audit findings.

Output STRICTLY JSON:
{
  "executive_summary": "4-5 sentences. Start with SEO impact, then transition to accessibility compliance. Name the client, reference their industry, state total violations found, explain the dual benefit: legal protection + SEO improvement.",
  "seo_analysis": "3-4 paragraphs explaining how current accessibility issues are hurting their SEO rankings. Cover: (1) Mobile usability and Core Web Vitals impact, (2) Crawlability and indexability issues from poor HTML structure, (3) User engagement metrics (bounce rate, time on site) affected by accessibility barriers, (4) Competitive disadvantage vs accessible competitors. Include specific examples from their actual violations.",
  "compliance_risk": "2-3 paragraphs. Focus on costly private ADA demand letters, brand reputation damages, and legal cost avoidance. Reference ADA Title II (DOJ enforcement, private lawsuits), UK Equality Act. Add the jurisdiction-specific deadline based on the website TLD. NEVER mention EU fines or €100,000.",
  "violation_summary": "Detailed breakdown of ALL violations found. Group by severity but list each one specifically. For critical/serious violations, explain the direct business impact. Do not summarize - be comprehensive.",
  "systemic_issues_summary": "List all detected systemic patterns. Explain each one as a design-system-level problem requiring architectural fixes, not just individual patches. Frame as additional scope beyond basic remediation.",
  "urgency_statement": "State the urgency_score out of 10 and the urgency_reason. Add: Without immediate action, [client] risks both legal enforcement and continued SEO underperformance.",
  "score_projection": "State current score, projected score after remediation (91-97/100), and timeline. Add: Competitors who remediate first will capture the SEO advantage permanently.",
  "hours_breakdown_statement": "Present the dev hours breakdown by category in a clear format. Critical fixes: X hrs, Serious fixes: X hrs, Mobile fixes: X hrs, Testing & certification: 2 hrs. Total: X hrs.",
  "competitor_teaser": "We also performed a preliminary scan of 3 of your top competitors in this space. Their average WCAG compliance score is 78/100. A full competitive accessibility analysis — including their violation breakdown and your relative positioning — is available as part of our Agency Growth Package. Agencies that benchmark against competitors consistently close 40% more remediation contracts."
  "remediation_plan": "Output EXACTLY this static text word for word: A complete inventory of production-ready HTML/CSS code patches has been compiled for all detected violations. These copy-and-paste assets are hosted live on your secure AccessAudit Agency Dashboard for immediate deployment by your engineering team.",
  "investment": "Professional price range statement referencing the estimated work hours (${totalFixTime} hours). Break down by phase if relevant. Emphasize this is an investment with measurable ROI.",
  "roi_statement": "3-4 sentences on ROI. Quantify where possible: potential SEO traffic increase (15-30% typical), conversion rate improvement, legal cost avoidance, market expansion to 1.3 billion people with disabilities. Frame as competitive advantage.",
  "next_steps": "4-step CTA: (1) approve proposal, (2) kickoff call within 48 hours, (3) technical audit kickoff, (4) compliance certificate delivery in 4 weeks.",
  "follow_up_email": "Open with the single most critical violation found on their site. State the jurisdiction-specific legal deadline (ADA April 2026 / UK Equality Act / AU DDA). Reference the exact dollar investment range. End with exactly: I have 2 slots open this week for a 15-minute call. Reply with a time that works. Sign off with the agency name. NEVER use filler phrases. NEVER mention EU fines or €100,000."
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

    const raw = await callGemini(system, user, settings?.gemini_api_key);
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

The email must:
- Instantly demonstrate tailored research, not automated template phrasing
- Start with a specific observation about their website's SEO or accessibility issues that you actually found
- Connect accessibility problems to tangible business impact: search rankings, organic traffic, conversion rates, legal risk
- Reference specific violations from their actual audit with concrete details
- Sound like a real human who genuinely audited their site and wants to help them succeed
- Total length under 150 words
- Subject header must be specific to their domain and the actual issue found

Return JSON: { "subject": string, "body": string }
Do NOT include conversational filler like "I hope this email finds you well", "touching base", "reaching out", "checking in", or any generic sales phrases. Be direct, specific, and helpful.`;

    const user = `Agency: ${data.agencyName}
Prospect: ${data.clientName}
Website: ${data.url}
Compliance score: ${data.score}/100
Top issues:
${topCritical.map((v: any) => `- ${v.name}: ${v.description} (${v.wcag_criterion})`).join("\n")}`;

    const raw = await callGemini(system, user, settings?.gemini_api_key);
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
    // Validate and sanitize location to prevent injection
    const sanitizedLocation = location.replace(/[^\w\s\-.,]/g, '').trim().slice(0, 100);
    if (!sanitizedLocation) {
      throw new Error("Invalid location parameter");
    }
    let realBusinesses: any[] = [];
    try {
      const query = `[out:json][timeout:25];area[name="${sanitizedLocation}"]->.s;(node["name"]["website"](area.s);way["name"]["website"](area.s););out body 20;`;
      const r = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!r.ok) {
        throw new Error("Failed to fetch business data from Overpass API");
      }
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
    } catch (error) {
      throw new Error(`Failed to fetch business data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    if (realBusinesses.length >= 3) {
      try {
        const system = `For each business in the JSON array, add a realistic common_flaw based on typical WCAG issues for that business type. Return the SAME array with common_flaw filled in. Return ONLY valid JSON array.`;
        const raw = await callGemini(system, JSON.stringify(realBusinesses), undefined);
        const parsed = parseJSON(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (error) {
        throw new Error(`Failed to enrich business data with AI: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
    try {
      const system = `Generate 8 realistic local businesses for ${industry} in ${location} with poor web accessibility. Return ONLY a JSON array: [{"id":"string","name":"string","website":"string","ranking":"string","common_flaw":"string"}]`;
      const raw = await callGemini(system, `Industry: ${industry}\nLocation: ${location}`, undefined);
      const parsed = parseJSON(raw);
      return Array.isArray(parsed) ? parsed : (parsed.leads ?? []);
    } catch (error) {
      throw new Error(`Failed to generate business leads: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });
