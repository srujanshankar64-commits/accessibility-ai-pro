import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getPlan, TIER, canRunAudit, PLAN_PRICES } from "@/lib/tier.utils";
import { Worker } from "worker_threads";

async function callGemini(systemPrompt: string, userPrompt: string, userApiKey?: string): Promise<string> {
  // Priority: .env (Owner's global key) -> Database (User's personal key)
  const rawKey = process.env.GOOGLE_GEMINI_API_KEY || userApiKey;
  const apiKey = rawKey?.trim();
  
  console.log("=== EXTREME DEBUG: callGemini KEY RESOLUTION ===");
  console.log("process.env.GOOGLE_GEMINI_API_KEY length:", process.env.GOOGLE_GEMINI_API_KEY?.length || "undefined");
  console.log("userApiKey length:", userApiKey?.length || "undefined");
  console.log("rawKey length:", rawKey?.length || "undefined");
  console.log("apiKey prefix:", apiKey?.substring(0, 8));
  console.log("===============================================");
  
  if (!apiKey) {
    throw new Error("AI service temporarily unavailable. Please add your Gemini API key in Settings or configure GOOGLE_GEMINI_API_KEY environment variable.");
  }

  try {
    const postData = JSON.stringify({
      contents: [
        {
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const data = await new Promise<any>((resolve, reject) => {
      try {
        // CRITICAL FIX: Run the request in a completely isolated Worker Thread!
        // Vite/Nitro's network interceptors and polyfills cannot reach into a separate V8 isolate.
        // This guarantees a 100% clean, native HTTPS request with absolutely zero leaked headers.
        const workerCode = `
          const { parentPort, workerData } = require('worker_threads');
          const https = require('node:https');
          
          const req = https.request(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + workerData.apiKey,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(workerData.postData)
              }
            },
            (res) => {
              let body = '';
              res.on('data', (c) => body += c);
              res.on('end', () => parentPort.postMessage({ status: res.statusCode, body }));
            }
          );
          req.on('error', (e) => parentPort.postMessage({ error: e.message }));
          req.write(workerData.postData);
          req.end();
        `;

        const worker = new Worker(workerCode, { 
          eval: true,
          workerData: { apiKey, postData } 
        });

        worker.on('message', (msg: any) => {
          if (msg.error) {
            reject({ message: msg.error });
            return;
          }
          try {
            const parsed = JSON.parse(msg.body);
            if (msg.status >= 400) {
              reject({
                message: JSON.stringify(parsed),
                status: msg.status
              });
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject({ message: "Failed to parse JSON response", status: msg.status });
          }
        });
        
        worker.on('error', reject);
      } catch (err) {
        reject(err);
      }
    });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || "{}";
  } catch (error: any) {
    // Explicitly logging the full error response object, status, and message
    console.error("[Diagnostics] Google AI API error:", {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText,
      name: error?.name,
      stack: error?.stack,
      rawError: error
    });
    
    // Throwing an error with the actual message to help debug in the network tab
    throw new Error(`AI service temporarily unavailable. Internal details: ${error?.message || "Unknown error"}`);
  }
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
  .inputValidator(z.object({ url: z.string().url() }))
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

CRITICAL INSTRUCTION FOR VIOLATIONS ARRAY:
DO NOT artificially limit or paginate the violations array to 12 or 15 items. If there are 50, 100, or multiple instances of the same bug across different elements (e.g., 40 distinct color contrast failures on individual buttons, missing alt text on dozens of images), you MUST loop through the entire page snippet and aggregate ALL of them. The final JSON array must contain a full, deep inventory of every single detected flaw to demonstrate massive diagnostic value.

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
  .inputValidator(
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
      competitorUrl: z.string().optional(),
      competitorScore: z.number().optional(),
      competitorViolations: z.number().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);
    const plan = getPlan(settings?.plan, 'srujanshankar64@gmail.com');

    if (!TIER[plan].proposals) {
      throw new Error(`Upgrade to Starter ($${PLAN_PRICES.starter}/mo) to generate client proposals.`);
    }

    let score = 50;
    let competitorData = null;
    
    if (data.auditId) {
      const { data: audit } = await (context.supabase as any).from("audits").select("overall_score, competitor_audit_id, competitor_url, has_competitor_benchmark").eq("id", data.auditId).maybeSingle();
      if (audit && audit.overall_score != null) score = audit.overall_score;
      
      // Fetch competitor data if benchmark was performed
      if (audit && audit.has_competitor_benchmark && audit.competitor_audit_id) {
        const { data: compAudit } = await (context.supabase as any).from("audits").select("overall_score, violations").eq("id", audit.competitor_audit_id).maybeSingle();
        if (compAudit) {
          competitorData = {
            url: audit.competitor_url,
            score: compAudit.overall_score,
            violations: Array.isArray(compAudit.violations) ? compAudit.violations.length : 0,
          };
        }
      }
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
8. COMPETITIVE GAP ANALYSIS (Business Elite): If competitor benchmark data is provided, include a dedicated 'competitive_gap_analysis' section that:
   - Compares the client's score directly against the competitor's score
   - Frames the remediation as a strategic move to neutralize the competitor's advantage
   - Explicitly mentions the competitor's name/URL for strategic relevance
   - Quantifies the gap in points and what it means for market position
   - If client is behind: Frame as urgent market risk requiring immediate action
   - If client is ahead: Frame as competitive advantage to maintain and expand

The proposal must:
1. Start with SEO and accessibility analysis - explain how their current accessibility issues are directly hurting their search rankings, organic traffic, and user experience. Mention specific SEO factors affected: crawlability, mobile usability, Core Web Vitals, and user engagement metrics.
2. Connect accessibility improvements to tangible SEO benefits: higher rankings, increased organic traffic, better conversion rates, and improved brand perception.
3. Then transition to compliance liability - cross-reference specific legal mandates: EU Accessibility Act, US ADA Title II, UK Equality Act.
4. Present ALL violations found in detail - do not summarize or group them. List each specific violation with its impact and priority level.
5. Frame remediation as a dual investment: legal compliance protection AND significant SEO/traffic growth.
6. Present pricing as a professional engineering project quote with clear deliverables.
7. Close with a clear corporate action plan and timeline.

Company Profile Logic: Dynamically read the website's meta description or context to accurately determine its industry. If the industry cannot be conclusively determined, strictly fallback to a safe, universal descriptor such as 'prominent digital platform' or 'online brand presence' instead of guessing specific business types like e-commerce. Use this logic when referencing their industry.

Tone: ${data.tone}. Write for a business executive, not a junior developer. Be thorough, specific, and data-driven. Avoid generic fluff - use concrete details from the actual audit findings.

Output STRICTLY JSON:
{
  "executive_summary": "4-5 sentences. Start with SEO impact, then transition to accessibility compliance. Name the client, reference their industry using the Company Profile Logic. State total violations found. Inject this exact static line: 'Sites achieving WCAG AA compliance typically rank 2–3 positions higher for the same keywords than non-compliant competitors in your industry.' Below the score, generate one dynamic sentence: 'This score places [site domain] in the bottom ${100 - score}% of audited platforms in our database.'",
  "seo_analysis": "3-4 paragraphs directly linking accessibility to Google mobile-first indexing, Core Web Vitals, and reducing bounce rates. Include specific examples from their actual violations.",
  "compliance_risk": "2-3 paragraphs focusing on costly private ADA demand letters, brand reputation damages, and legal cost avoidance. Do NOT use aggressive scare tactics or mention EU Act €100,000 fines. Add a compliance deadline sentence at the end of this field: Detect country from URL TLD or page context (.com.au = 'Australian DDA compliance expected', .co.uk = 'UK Equality Act enforcement active — no SMB exemptions', .com = 'ADA Title II deadline: April 2026 — 3,117 lawsuits in 2025', EU = 'EU Accessibility Act enforced June 2025', fallback to US).",
  "violation_summary": "Detailed breakdown of ALL violations found. Group by severity but list each one specifically. For critical/serious violations, explain the direct business impact. Do not summarize - be comprehensive.",
  "systemic_issues_summary": "List all detected systemic patterns. Explain each one as a design-system-level problem requiring architectural fixes, not just individual patches. Frame as additional scope beyond basic remediation.",
  "urgency_statement": "State the urgency_score out of 10 and the urgency_reason. Add: Without immediate action, [client] risks both legal enforcement and continued SEO underperformance.",
  "score_projection": "State current score, projected score after remediation (91-97/100), and timeline. Add: Competitors who remediate first will capture the SEO advantage permanently.",
  "hours_breakdown_statement": "Present the dev hours breakdown by category in a clear format. Critical fixes: X hrs, Serious fixes: X hrs, Mobile fixes: X hrs, Testing & certification: 2 hrs. Total: X hrs.",
  "competitor_teaser": "We also performed a preliminary scan of 3 of your top competitors in this space. Their average WCAG compliance score is 78/100. A full competitive accessibility analysis — including their violation breakdown and your relative positioning — is available as part of our Agency Growth Package. Agencies that benchmark against competitors consistently close 40% more remediation contracts.",
  "remediation_plan": "Output exactly this static text: 'A complete inventory of production-ready HTML/CSS code patches has been compiled for all detected violations. These copy-and-paste assets are hosted live on your secure AccessAudit Agency Dashboard for immediate deployment by your engineering team.'",
  "investment": "Professional price range statement referencing the estimated work hours (${totalFixTime} hours). Break down by phase if relevant. Emphasize this is an investment with measurable ROI.",
  "roi_statement": "3-4 sentences on ROI. Quantify where possible: potential SEO traffic increase (15-30% typical), conversion rate improvement, legal cost avoidance, market expansion to 1.3 billion people with disabilities. Frame as competitive advantage.",
  "next_steps": "4-step CTA: (1) approve proposal, (2) kickoff call within 48 hours, (3) technical audit kickoff, (4) compliance certificate delivery in 4 weeks.",
    "follow_up_email": "Output a PLAIN TEXT STRING only — never an object or JSON. Format: first sentence names the single most critical violation found on the site. Second sentence states the ADA Title II April 2026 deadline. Third sentence references the exact price range. Final sentence: I have 2 slots open this week for a 15-minute call. Reply with a time that works. Sign off with the agency name. No subject line, no JSON, no object — plain email body text only."
}`;

    // Build competitive gap analysis if competitor data provided
    let competitiveAnalysis = "";
    if (competitorData) {
      const scoreGap = score - competitorData.score;
      const gapDirection = scoreGap > 0 ? "ahead of" : scoreGap < 0 ? "behind" : "tied with";
      competitiveAnalysis = `

COMPETITIVE BENCHMARK:
Competitor: ${competitorData.url}
Competitor Score: ${competitorData.score}/100
Your Client Score: ${score}/100
Gap: Your client is ${Math.abs(scoreGap)} points ${gapDirection} the competitor
${scoreGap < 0 ? "MARKET RISK: Your client lags behind competitor on accessibility, creating legal and competitive disadvantage." : "COMPETITIVE ADVANTAGE: Your client leads competitor on accessibility compliance."}`;
    }

    const user = `Agency: ${data.agencyName}
Client: ${data.clientName}
Industry: ${data.clientIndustry}
Website: ${data.url ?? ""}
Score: ${score}/100
Violations: ${data.violations.length} total, ${criticalViolations.length} critical/serious
Estimated fix time: ${totalFixTime} hours
Price range: $${data.priceMin} - $${data.priceMax}${competitiveAnalysis}

Violations:
${data.violations.map((v: any, i: number) => `${i + 1}. [${v.severity?.toUpperCase()}] ${v.name} (${v.wcag_criterion}) - ${v.description} | Fix: ${v.fix_instructions} | Time: ${v.estimated_fix_time ?? "2 hours"}`).join("\n")}`;

    const raw = await callGemini(system, user, settings?.gemini_api_key);
    return parseJSON(raw);
  });

export const generateColdEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      agencyName: z.string().default(""),
      clientName: z.string().default(""),
      url: z.string().default(""),
      violations: z.array(z.any()).default([]),
      score: z.number().default(0),
    }),
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
- Must cite a specific jurisdiction-specific legal deadline relevant to the violations (ADA Title II April 2026 for US, UK Equality Act for UK, AU DDA for Australia)
- Must end with a clear call to action and sign off with exactly this agency name: ${data.agencyName}. NEVER invent a different agency name.

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
  .inputValidator(
    z.object({
      auditId: z.string().uuid(),
      url: z.string(),
      score: z.number(),
      agencyName: z.string().default(""),
      clientName: z.string().default(""),
    }),
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

export const generateWebsitePitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      businessName: z.string().min(1),
      industry: z.string().min(1),
      city: z.string().default(""),
      customerType: z.string().default("B2C"),
      currentMarketing: z.string().default("Word of mouth only"),
      employees: z.string().default("1-5"),
      agencyName: z.string().default("Your Agency"),
      priceMin: z.number().default(2000),
      priceMax: z.number().default(8000),
    }),
  )
  .handler(async ({ data, context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);

    const system = `You are an elite B2B digital agency consultant writing a website creation proposal for a business with NO online presence. Write in a professional, consultative tone that educates the prospect on what they are missing and positions the agency as the expert solution.

CRITICAL RULES:
1. Never be pushy or salesy — be consultative and data-driven
2. Use real statistics: 81% of consumers research online before buying, 75% judge credibility by website design
3. Frame competitors as the threat, not the agency
4. Present the agency as a partner, not a vendor
5. ROI must be specific: "local service businesses with websites generate 35% more leads on average"
6. Include a competitor analysis teaser: "We scanned your top 3 local competitors in [city] — all have websites ranking on Google for [industry] keywords in your area"
7. Personalize based on customer type, current marketing method, and team size — make it feel like real research was done on this specific business
7. Close with a low-friction CTA: free 1-page homepage mockup concept

Output STRICTLY valid JSON:
{
  "executive_summary": "3-4 sentences. Open with the market opportunity they are missing. Reference the 81% stat. Name their industry specifically. Frame this as a revenue opportunity, not a technical necessity.",
  "market_analysis": "2-3 paragraphs. Cover: (1) How many local consumers search online before buying in their industry, (2) What competitors are doing online that this business is missing, (3) The cost of invisibility — lost leads, lost revenue, lost trust.",
  "competitor_insight": "2 paragraphs. 'We performed a preliminary scan of your top local competitors in [industry]. All 3 have active websites ranking on Google for [industry] keywords in your area. Without a digital presence, every Google search in your area sends potential customers directly to your competitors. A professional website positions you to capture this traffic and convert it into paying customers.'",
  "proposed_solution": "3-4 sentences describing what the agency will build: professional homepage, mobile-optimized, SEO-ready, contact/booking form, Google My Business integration. Frame it as a complete digital presence package, not just a website.",
  "investment": "Professional price range statement for $[priceMin] - $[priceMax]. Break into: Design & Development, SEO Setup, Google My Business, 30-day post-launch support. Frame as ROI: at even 1 new client per month from the website, it pays for itself.",
  "roi_statement": "3 sentences. Quantify: local businesses with websites generate 35% more leads, 75% of consumers judge credibility by website design, first-page Google visibility for local searches. Frame as competitive advantage.",
  "next_steps": "4 steps: (1) Approve this proposal, (2) 48-hour kickoff call, (3) We deliver a free 1-page homepage mockup concept within 72 hours, (4) Full site live within 3-4 weeks.",
  "pitch_email": "Output ONE plain text string only — never JSON, never an object with subject/body keys. Format: Subject: [Business Name] — Your competitors are winning online. Then two newlines. Then email body: open with the most powerful stat for their industry, reference 3 local competitors having websites, offer a free homepage mockup, end with: I have 2 slots open this week for a 15-minute call. Reply with a time that works. Sign off with agency name. Under 150 words."
}`;

    const user = `Business Name: ${data.businessName}
Industry: ${data.industry}
Agency: ${data.agencyName}
Price Range: ${data.priceMin} - ${data.priceMax}`;

    const raw = await callGemini(system, user, settings?.gemini_api_key);
    return parseJSON(raw);
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
  .inputValidator(
    z.object({ industry: z.string(), location: z.string() }),
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
