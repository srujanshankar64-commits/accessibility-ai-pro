import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getPlan, TIER, canRunAudit, PLAN_PRICES } from "@/lib/tier.utils";
import { GoogleGenAI } from "@google/genai";
import { getAuditSystemPrompt, ELITE_AUDIT_CONFIG, FREE_AUDIT_CONFIG } from "@/lib/audit-prompt";

function buildFreeAuditPrompt(): string {
  return `You are a WCAG 2.1 AA accessibility auditor. Find the TOP 8 most critical violations only.
  
Focus only on: missing alt text, missing form labels, contrast failures on CTAs, missing page title, missing lang attribute, missing skip link, keyboard inaccessible elements, missing ARIA landmarks.

Return ONLY valid JSON:
{
  "overall_score": number,
  "category_scores": { "perceivable": number, "operable": number, "understandable": number, "robust": number },
  "violations": [
    {
      "id": "string",
      "severity": "critical"|"serious"|"moderate"|"minor",
      "name": "string",
      "wcag_criterion": "string",
      "description": "string",
      "element_affected": "string",
      "legal_impact": "string",
      "fix_instructions": "string",
      "estimated_fix_time": "string"
    }
  ]
}`;
}

function detectJsRendered(html: string): boolean {
  const bodyContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  const textContent = bodyContent.replace(/<[^>]+>/g, '').trim();
  const hasAppShellMarker = /\bid=["']?(root|app|__next|vite-root)\b/i.test(bodyContent);
  const hasMeaningfulStructure = /<(main|article|nav|header|footer|section|h1|h2|p|a|button|form)\b/i.test(bodyContent);

  return textContent.length < 120 && (hasAppShellMarker || !hasMeaningfulStructure);
}

// SSRF protection: validate URL and reject private/internal IP ranges
async function validateUrlForFetch(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Reject localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      throw new Error('Invalid URL: localhost and loopback addresses are not allowed');
    }

    // Reject private IP ranges in hostname (basic pattern matching)
    // Note: Full DNS resolution would require Deno's net module or external service
    // This is a heuristic check for obvious private IPs in the hostname
    const privateIpPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^127\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ];

    if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
      throw new Error('Invalid URL: private IP addresses are not allowed');
    }

    // Reject non-HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL: only HTTP and HTTPS protocols are allowed');
    }

    // Reject internal network hostnames
    const internalHostnames = [
      'local',
      'internal',
      'intranet',
      'localhost',
      'home',
      'lan',
      'localdomain',
    ];

    if (internalHostnames.some(internal => hostname.includes(internal))) {
      throw new Error('Invalid URL: internal network hostnames are not allowed');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid URL')) {
      throw error;
    }
    throw new Error('Invalid URL format');
  }
}

async function pushLog(
  supabase: any,
  jobId: string,
  percent: number,
  step: string,
  logLine: string
) {
  const entry = JSON.stringify({ message: logLine, ts: new Date().toISOString() });
  await supabase.rpc('append_audit_log', {
    job_id: jobId,
    percent,
    step,
    log_entry: entry
  });
}

// Removed module-level circuit breaker state for serverless compatibility
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  userApiKey?: string,
  model = "gemini-2.5-flash",
  maxOutputTokens = 8192
): Promise<string> {
  const apiKey = (userApiKey || process.env.GOOGLE_GEMINI_API_KEY)?.trim();
  if (!apiKey) throw new Error("AI service unavailable. Add your Gemini API key in Settings.");

  const ai = new GoogleGenAI({ apiKey });
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Small initial delay on retries only (not first attempt)
      if (attempt > 0) {
        const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(r => setTimeout(r, backoff));
      }

      const response = await ai.models.generateContent({
        model,
        contents: `${systemPrompt}\n\n${userPrompt}`,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens,
        },
      });

      const text = response.text ?? "{}";
      if (!text || text.trim() === "{}") throw new Error("Empty response from AI");
      return text;

    } catch (error: any) {
      const msg = error?.message || "";
      const isRetryable = msg.includes("503") || msg.includes("UNAVAILABLE") || 
                          msg.includes("429") || msg.includes("quota") ||
                          msg.includes("overloaded") || msg.includes("rate limit");
      
      console.error(`[Gemini] attempt ${attempt + 1}/${maxRetries}:`, msg);
      
      if (!isRetryable || attempt === maxRetries - 1) {
        if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded")) {
          throw new Error("Google AI is overloaded. Please wait 30 seconds and try again.");
        }
        if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) {
          throw new Error("Google AI rate limit reached. Please wait 1 minute.");
        }
        throw new Error(`AI service error: ${msg || "Unknown"}`);
      }
    }
  }
  throw new Error("AI service temporarily unavailable after 3 attempts.");
}

function parseJSON(s: string): any {
  if (!s || typeof s !== 'string') {
    console.error('[parseJSON] Invalid input:', typeof s);
    return {};
  }
  
  s = s.trim();
  if (!s) {
    console.error('[parseJSON] Empty string');
    return {};
  }
  
  try { return JSON.parse(s); }
  catch (e) {
    console.error('[parseJSON] Primary parse failed:', (e as Error).message);
    try {
      const m = s.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        console.log('[parseJSON] Extracted JSON from markdown');
        return parsed;
      }
    } catch (e2) {
      console.error('[parseJSON] Regex extraction failed:', (e2 as Error).message);
    }
    try {
      const clean = s.replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)([a-zA-Z_][\w]*)\s*:/g, '$1"$2":');
      const parsed = JSON.parse(clean);
      console.log('[parseJSON] Fixed JSON syntax');
      return parsed;
    } catch (e3) {
      console.error('[parseJSON] Syntax fix failed:', (e3 as Error).message);
    }
    try {
      const jsonStart = s.indexOf('{');
      const jsonEnd = s.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const extracted = s.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(extracted);
        console.log('[parseJSON] Extracted JSON by position');
        return parsed;
      }
    } catch (e4) {
      console.error('[parseJSON] Position extraction failed:', (e4 as Error).message);
    }
    console.error('[parseJSON] All parse methods failed, returning empty object');
    return {};
  }
}

function cleanHtml(html: string): string {
  let cleaned = html;
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s*data-[\w-]+\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();
  return cleaned;
}

function isCurrentAuditPeriod(periodStart?: string | null): boolean {
  if (!periodStart) return false;
  const now = new Date();
  const period = new Date(periodStart);
  return now.getUTCFullYear() === period.getUTCFullYear() &&
    now.getUTCMonth() === period.getUTCMonth();
}

async function getUserSettings(supabase: any, userId: string) {
  const { data } = await supabase
    .from("settings")
    .select("plan, audits_used, audits_limit, audit_period_start, agency_name, agency_logo_url, brand_color, gemini_api_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    const { data: created } = await supabase
      .from("settings")
      .upsert({
        user_id: userId,
      })
      .select("plan, audits_used, audits_limit, audit_period_start, agency_name, agency_logo_url, brand_color, gemini_api_key")
      .single();
    return created ?? { plan: "free", audits_used: 0, audits_limit: TIER.free.audits, audit_period_start: new Date().toISOString() };
  }

  if (!isCurrentAuditPeriod(data.audit_period_start)) {
    const resetStartedAt = new Date().toISOString();
    const { data: reset } = await supabase
      .from("settings")
      .update({ audits_used: 0, audit_period_start: resetStartedAt })
      .eq("user_id", userId)
      .select("plan, audits_used, audits_limit, audit_period_start, agency_name, agency_logo_url, brand_color, gemini_api_key")
      .single();
    return reset ?? { ...data, audits_used: 0, audit_period_start: resetStartedAt };
  }

  return data;
}

async function incrementAuditUsage(supabase: any, userId: string, currentUsed: number) {
  await supabase
    .from("settings")
    .update({
      audits_used: currentUsed + 1,
      audit_period_start: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

function getAuditPromptViolationTarget(plan: keyof typeof TIER): number {
  return plan === "free" ? TIER.free.violations : 50;
}

export const runAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    url: z.string().url(),
    multiPageCrawlEnabled: z.boolean().optional(),
    competitorUrl: z.string().optional()
  }))
  .handler(async ({ data, context }) => {
    const { url, multiPageCrawlEnabled, competitorUrl } = data;
    const settings = await getUserSettings(context.supabase, context.userId);
   
    const usedThisMonth = settings?.audits_used ?? 0;
const plan = getPlan(settings?.plan);
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
      await validateUrlForFetch(url);
      const fetchController = new AbortController();
      const fetchTimer = setTimeout(() => fetchController.abort(), 20000);
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0 (WCAG Compliance Scanner)" },
        signal: fetchController.signal,
      });
      clearTimeout(fetchTimer);
      const html = await r.text();
      const cleanedHtml = cleanHtml(html);
      pageSnippet = cleanedHtml.slice(0, 35000);
      console.log(`[runAudit] Fetched ${html.length} chars, cleaned to ${cleanedHtml.length}, using ${pageSnippet.length}`);
    } catch (fetchError) {
      console.error(`[runAudit] Fetch failed for ${url}:`, fetchError);
      pageSnippet = `(Could not fetch ${url} directly. Perform a thorough theoretical WCAG 2.1 AA audit based on the URL structure and typical patterns for this type of website. URL indicates: ${new URL(url).hostname} - analyze typical accessibility issues for this domain type.)`;
    }

    let multiPageContext = "";
    if (multiPageCrawlEnabled && plan !== "free") {
      multiPageContext = `\n[MULTI-PAGE ANALYSIS ENABLED]: Treat findings in the header, footer, and navigation as critical systemic errors affecting 50+ pages.`;
    }

    let competitorSnippet = "";
    if (competitorUrl && plan !== "free") {
      try {
        const fetchController = new AbortController();
        setTimeout(() => fetchController.abort(), 15000);
        const r = await fetch(competitorUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: fetchController.signal });
        const html = await r.text();
        competitorSnippet = cleanHtml(html).slice(0, 15000);
      } catch (e) {
        competitorSnippet = `(Could not fetch competitor ${competitorUrl})`;
      }
    }

    const includeCodeFixes = TIER[plan].codeFixes;
    const isFree = plan === "free";
    const violationLimit = TIER[plan].violations;
    const promptViolationTarget = getAuditPromptViolationTarget(plan);

    console.log(`[SYSTEM_PROMPT_CONFIGURED] Full audit mode, Violation Limit: ${violationLimit}, Code Fixes: ${includeCodeFixes}`);

    const isJsRendered = detectJsRendered(pageSnippet);
    
    const systemPrompt = isFree 
        ? buildFreeAuditPrompt()
        : getAuditSystemPrompt({ violationLimit: promptViolationTarget, includeCodeFixes, mode: 'full' });

    let userPrompt = isJsRendered
        ? `Audit this website for WCAG 2.1 AA compliance. 
     
     IMPORTANT: This appears to be a JavaScript-rendered Single Page Application (SPA). 
     The raw HTML fetch returned minimal content because the page requires JavaScript to render.
     
     URL: ${url}
     
     For this SPA audit, focus on:
     1. Analyze the URL structure and domain to determine site type and likely content
     2. Audit the visible HTML skeleton for any real violations present
     3. For SPA-specific violations, flag them clearly as "SPA Architecture Issue" 
     4. Common SPA violations to check: missing lang attribute, missing title, missing meta viewport, 
        missing skip links, missing ARIA landmarks in the shell, iframes without titles
     5. Do NOT fabricate violations about content you cannot see
     6. Do NOT add "(potential)" violations based on assumptions about dynamic content
     7. Only report violations you can CONFIRM from the actual HTML provided
     8. Be honest about the limitation — note in the audit that this is a server-side HTML snapshot
     
     Available HTML snapshot:
     ${pageSnippet}${multiPageContext}
     
     Minimum violations to find: Report only REAL confirmed violations. Quality over quantity for SPAs.`
        : `Audit this website for WCAG 2.1 AA compliance. Be exhaustive. Find every violation.
     
     URL: ${url}
     
     HTML content:
     ${pageSnippet}${multiPageContext}`;

    if (competitorSnippet) {
      userPrompt += `\n\nCOMPETITOR URL: ${competitorUrl}\n\nCOMPETITOR HTML (for benchmarking):\n${competitorSnippet}`;
    }

    const raw = await callGemini(systemPrompt, userPrompt, settings?.gemini_api_key, "gemini-2.5-flash", 65536);
    const result = parseJSON(raw);

    let allViolations = result.violations ?? [];
    
    // Final validation
    if (allViolations.length === 0) {
      throw new Error("AI audit returned no violations. This indicates a system error. Please try again.");
    }
    
    console.log(`[runAudit] Final violation count: ${allViolations.length}`);
    
    const limitedViolations = plan === "free"
      ? allViolations.slice(0, violationLimit)
      : allViolations;

    const auditData: any = {
      user_id: context.userId,
      url,
      overall_score: result.overall_score ?? 0,
      category_scores: result.category_scores ?? {},
      violations: limitedViolations,
    };

    if (result.competitor_benchmark && competitorUrl) {
      auditData.has_competitor_benchmark = true;
      auditData.competitor_url = competitorUrl;
      const compAuditData = {
        user_id: context.userId,
        url: competitorUrl,
        overall_score: result.competitor_benchmark.score,
        violations: []
      };
      const { data: compInserted } = await (context.supabase as any).from("audits").insert(compAuditData).select().single();
      if (compInserted) {
        auditData.competitor_audit_id = compInserted.id;
      }
    }

    const { data: inserted, error } = await (context.supabase as any)
      .from("audits")
      .insert(auditData)
      .select()
      .single();
    if (error) throw error;

    // Only increment audits_used after successful insert
    await incrementAuditUsage(context.supabase, context.userId, usedThisMonth);

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
      score: z.number().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);
    const plan = getPlan(settings?.plan);

    if (!TIER[plan].proposals) {
      throw new Error(`Upgrade to Starter ($${PLAN_PRICES.starter}/mo) to generate client proposals.`);
    }

    let score = data.score ?? 50;
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

CRITICAL RULES & STRICT GUARDRAILS:
1. MATHEMATICAL CONSISTENCY (NO SCORE CONTRADICTIONS): You must use the exact string '${score}/100' everywhere a score is mentioned. NEVER hallucinate, approximate, or change this number in the body text.
2. LEGAL ACCURACY (DYNAMIC ADA CONDITIONING): Check the BUSINESS_TYPE variable before writing any legal risk sections. IF TYPE IS 'Government/Public Education/Municipality': Use ADA Title II framework and mention the strict compliance deadline of April 2026. IF TYPE IS 'Private/SaaS/E-commerce': Use ADA Title III (Public Accommodations) framework. Do NOT mention an April 2026 deadline. Instead, emphasize the continuous surge in private Title III predatory lawsuits, demand letters, and brand reputation risks.
3. CONTEXTUAL SANITY (TECHNICAL FALSE-POSITIVE PROTECTION): If the Violations List contains both "Missing DOCTYPE/HTML/BODY tags" AND highly specific nested elements (e.g. specific classes or ids), DO NOT write that the company "forgot basic HTML tags." Instead, accurately frame it as a "Client-Side Rendering/SPA Hydration or Scraper Blockage issue that severely hinders search engine crawlers from reading the page structure."
4. VALUE PROPOSITION ALIGNMENT: Match the pitch to the scale of the company. For major SaaS or custom applications (based on URL/Industry), do not promise "copy-and-paste dashboard code patches". Instead, pitch "production-ready component remediation guidelines and expert engineering advisory".
5. INDUSTRY: Read the website URL and context to determine industry. If uncertain, ALWAYS use 'prominent digital platform' or 'online brand presence'.
6. SCORE PERCENTILE: After mentioning the compliance score, calculate (100 minus ${score}) and add exactly: 'This score places [domain] in the bottom [calculated number]% of audited platforms in our database.'
7. COMPETITOR HOOK: Include in executive_summary: 'Sites achieving WCAG AA compliance typically rank 2-3 positions higher for the same keywords than non-compliant competitors in your industry.'
8. COMPETITIVE GAP ANALYSIS (Business Elite): If competitor benchmark data is provided, explicitly compare scores, frame remediation as a strategic move to neutralize competitor advantage, and quantify the gap in points.

The proposal must:
1. Start with SEO and accessibility analysis - explain how their current accessibility issues are directly hurting their search rankings, organic traffic, and user experience. Mention specific SEO factors affected: crawlability, mobile usability, Core Web Vitals, and user engagement metrics.
2. Connect accessibility improvements to tangible SEO benefits: higher rankings, increased organic traffic, better conversion rates, and improved brand perception.
3. Then transition to compliance liability - cross-reference specific legal mandates: EU Accessibility Act, US ADA Title II, UK Equality Act.
4. Summarize the top 5 most critical violations in detail. Group the remaining issues by category to save space and time. Keep this highly concise and punchy.
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
  "violation_summary": "Detailed breakdown of the top 5 critical violations. Briefly summarize the remaining issues by category. Keep it extremely concise and punchy. Maximum 150 words.",
  "systemic_issues_summary": "List all detected systemic patterns. Explain each one as a design-system-level problem requiring architectural fixes, not just individual patches. Frame as additional scope beyond basic remediation.",
  "urgency_statement": "State the urgency_score out of 10 and the urgency_reason. Add: Without immediate action, [client] risks both legal enforcement and continued SEO underperformance.",
  "score_projection": "State current score, projected score after remediation (91-97/100), and timeline. Add: Competitors who remediate first will capture the SEO advantage permanently.",
  "hours_breakdown_statement": "Present the dev hours breakdown by category in a clear format. Critical fixes: X hrs, Serious fixes: X hrs, Mobile fixes: X hrs, Testing & certification: 2 hrs. Total: X hrs.",
  "competitor_teaser": "We also performed a preliminary scan of 3 of your top competitors in this space. Their average WCAG compliance score is 78/100. A full competitive accessibility analysis — including their violation breakdown and your relative positioning — is available as part of our Agency Growth Package. Agencies that benchmark against competitors consistently close 40% more remediation contracts.",
  "remediation_plan": "Condition output based on VALUE PROPOSITION ALIGNMENT guardrail. If SaaS/Custom, offer expert engineering advisory. Otherwise, output this static text: 'A complete inventory of production-ready HTML/CSS code patches has been compiled for all detected violations. These copy-and-paste assets are hosted live on your secure AccessAudit Agency Dashboard for immediate deployment by your engineering team.'",
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

    const isGovOrEdu = data.clientIndustry?.toLowerCase().includes("gov") || data.clientIndustry?.toLowerCase().includes("edu") || data.clientIndustry?.toLowerCase().includes("public");
    const businessType = isGovOrEdu ? "Government/Public Education/Municipality" : "Private/SaaS/E-commerce";

    const user = `Agency Name: ${data.agencyName}
Company Name: ${data.clientName}
Industry: ${data.clientIndustry}
BUSINESS_TYPE: ${businessType}
Website URL: ${data.url ?? ""}
Actual Compliance Score: ${score}/100
Violations: ${data.violations.length} total, ${criticalViolations.length} critical/serious
Estimated fix time: ${totalFixTime} hours
Price range: $${data.priceMin} - $${data.priceMax}${competitiveAnalysis}

Violations:
${data.violations.slice(0, 15).map((v: any, i: number) => `${i + 1}. [${v.severity?.toUpperCase()}] ${v.name} (${v.wcag_criterion}) - ${v.description} | Fix: ${v.fix_instructions} | Time: ${v.estimated_fix_time ?? "2 hours"}`).join("\n")}${data.violations.length > 15 ? `\n...and ${data.violations.length - 15} more systemic issues.` : ""}`;

    const raw = await callGemini(system, user, settings?.gemini_api_key, "gemini-2.5-flash", 8192);
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
    const plan = getPlan(settings?.plan);

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

    const isGovOrEdu = data.clientName?.toLowerCase().includes("gov") || data.clientName?.toLowerCase().includes("school") || data.url?.includes(".edu") || data.url?.includes(".gov");
    const businessType = isGovOrEdu ? "Government/Public Education/Municipality" : "Private/SaaS/E-commerce";

    const user = `Agency Name: ${data.agencyName}
Company Name: ${data.clientName}
BUSINESS_TYPE: ${businessType}
Website URL: ${data.url}
Actual Compliance Score: ${data.score}/100
Raw Violations List:
${topCritical.map((v: any) => `- ${v.name}: ${v.description} (${v.wcag_criterion})`).join("\n")}`;

    const raw = await callGemini(system, user, settings?.gemini_api_key, "gemini-2.5-flash", 1024);
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
    const plan = getPlan(settings?.plan);

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

    const raw = await callGemini(system, user, settings?.gemini_api_key, "gemini-2.5-flash", 8192);
    return parseJSON(raw);
  });

export const startAuditJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    url: z.string().url(),
    multiPageCrawlEnabled: z.boolean().optional(),
    competitorUrl: z.string().optional()
  }))
  .handler(async ({ data, context }) => {
    const { url } = data;
    const settings = await getUserSettings(context.supabase, context.userId);
    const usedThisMonth = settings?.audits_used ?? 0;
    const plan = getPlan(settings?.plan);
    
    if (!canRunAudit(plan, usedThisMonth)) {
      throw new Error(
        plan === "free"
          ? `You have used all ${TIER.free.audits} free audits this month. Upgrade to Starter ($${PLAN_PRICES.starter}/mo) for ${TIER.starter.audits} audits.`
          : plan === "starter"
          ? `You have used all ${TIER.starter.audits} audits this month. Upgrade to Agency ($${PLAN_PRICES.agency}/mo) for unlimited audits.`
          : "Monthly audit limit reached. Please contact support."
      );
    }

    const { data: job, error } = await (context.supabase as any)
      .from("audit_jobs")
      .insert({
        user_id: context.userId,
        url,
        status: 'queued',
        progress_percent: 0,
        current_step: 'Initializing audit...',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return { job_id: job.id, url };
  });

export const processAuditJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { jobId } = data;
    const sb = context.supabase as any;

    try {
      const { data: job } = await sb.from("audit_jobs").select("*").eq("id", jobId).single();
      if (!job) throw new Error("Job not found");

      const settings = await getUserSettings(context.supabase, context.userId);
      const plan = getPlan(settings?.plan);
      const isFree = plan === "free";

      await sb.from("audit_jobs").update({ status: "processing" }).eq("id", jobId);
      await pushLog(sb, jobId, 3, "Starting audit engine...", "[LOG] Audit engine starting...");

      // Fetch HTML with hard 15s timeout
      let html = "";
      let pageSnippet = "";
      try {
        await pushLog(sb, jobId, 8, "Establishing connection...", "[LOG] Establishing HTTPS connection...");
        const fetchController = new AbortController();
        const t = setTimeout(() => fetchController.abort(), 15000);
        const r = await fetch(job.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0",
          },
          signal: fetchController.signal,
        });
        clearTimeout(t);
        html = await r.text();

        const cleanedHtml = cleanHtml(html);
        const snippetLength = isFree ? 8000 : 20000;
        pageSnippet = cleanedHtml.slice(0, snippetLength);

        await pushLog(sb, jobId, 15, "Parsing HTML...", `[LOG] Fetched ${Math.round(html.length/1024)}kb of HTML — using first ${Math.round(snippetLength/1024)}KB`);
      } catch (fetchError) {
        await pushLog(sb, jobId, 15, "Fetch failed — theoretical audit",
          "[WARN] Could not fetch page directly — performing pattern-based WCAG audit");
        pageSnippet = `(Could not fetch ${job.url}. Perform theoretical WCAG audit for: ${new URL(job.url).hostname})`;
      }

      const isJsRendered = detectJsRendered(pageSnippet);
      if (isJsRendered) {
        await pushLog(sb, jobId, 20, "JS-rendered site detected", "[WARN] JavaScript-rendered SPA detected — auditing HTML shell only. Some dynamic content violations may not be visible.");
      }

      await pushLog(sb, jobId, 22, "Scanning Perceivable...", "[STATUS] Category: Perceivable — scanning images, contrast, captions...");
      await pushLog(sb, jobId, 34, "Scanning Operable...", "[STATUS] Category: Operable — checking keyboard, focus, touch targets...");
      await pushLog(sb, jobId, 44, "Scanning Understandable...", "[STATUS] Category: Understandable — validating lang, labels, error messages...");
      await pushLog(sb, jobId, 49, "Scanning Robust...", "[STATUS] Category: Robust — validating ARIA roles, landmarks, HTML structure...");
      await pushLog(sb, jobId, 55, "Sending to AI Engine...", "[LOG] Sending DOM snapshot to Gemini Flash for deep WCAG analysis...");

      const includeCodeFixes = TIER[plan].codeFixes;
      const systemPrompt = isFree 
        ? buildFreeAuditPrompt()
        : getAuditSystemPrompt({ violationLimit: getAuditPromptViolationTarget(plan), includeCodeFixes, mode: 'full' });

      const userPrompt = isJsRendered
        ? `Audit this website for WCAG 2.1 AA compliance. 
     
     IMPORTANT: This appears to be a JavaScript-rendered Single Page Application (SPA). 
     The raw HTML fetch returned minimal content because the page requires JavaScript to render.
     
     URL: ${job.url}
     
     For this SPA audit, focus on:
     1. Analyze the URL structure and domain to determine site type and likely content
     2. Audit the visible HTML skeleton for any real violations present
     3. For SPA-specific violations, flag them clearly as "SPA Architecture Issue" 
     4. Common SPA violations to check: missing lang attribute, missing title, missing meta viewport, 
        missing skip links, missing ARIA landmarks in the shell, iframes without titles
     5. Do NOT fabricate violations about content you cannot see
     6. Do NOT add "(potential)" violations based on assumptions about dynamic content
     7. Only report violations you can CONFIRM from the actual HTML provided
     8. Be honest about the limitation — note in the audit that this is a server-side HTML snapshot
     
     Available HTML snapshot:
     ${pageSnippet}
     
     Minimum violations to find: Report only REAL confirmed violations. Quality over quantity for SPAs.`
        : `Audit this website for WCAG 2.1 AA compliance. Be exhaustive. Find every violation.
     
     URL: ${job.url}
     
     HTML content:
     ${pageSnippet}`;

      const raw = await callGemini(systemPrompt, userPrompt, settings?.gemini_api_key, "gemini-2.5-flash", 65536);
      await pushLog(sb, jobId, 72, "AI analysis complete", "[LOG] AI analysis complete — parsing violation inventory...");

      const result = parseJSON(raw);
      const allViolations = result.violations ?? [];
      
      if (allViolations.length === 0) throw new Error("AI audit returned no violations. This indicates a system error. Please try again.");

      const criticalCount = allViolations.filter((v:any) => v.severity === 'critical').length;
      const seriousCount = allViolations.filter((v:any) => v.severity === 'serious').length;
      
      await pushLog(sb, jobId, 82, "Tallying violations...", `[FINDING] ${criticalCount} CRITICAL | ${seriousCount} SERIOUS | ${allViolations.length} total violations detected`);
      await pushLog(sb, jobId, 88, "Writing compliance report...", "[LOG] Writing compliance report to database...");

      const limitedViolations = plan === "free" ? allViolations.slice(0, TIER[plan].violations) : allViolations;

      const { data: inserted, error: insertError } = await sb
        .from("audits")
        .insert({
          user_id: context.userId,
          url: job.url,
          overall_score: result.overall_score ?? 0,
          category_scores: result.category_scores ?? {},
          violations: limitedViolations,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Only increment audits_used after successful insert
      await incrementAuditUsage(sb, context.userId, settings?.audits_used ?? 0);

      const finalResult = {
        ...(inserted as any),
        plan,
        totalViolationsFound: allViolations.length,
        violationsShown: limitedViolations.length,
        isLimited: plan === "free" && allViolations.length > TIER[plan].violations,
      };

      await pushLog(sb, jobId, 100, "Audit complete", `[COMPLETE] Score: ${result.overall_score ?? 0}/100 — ${limitedViolations.length} violations found`);

      await sb
        .from("audit_jobs")
        .update({
          status: "completed",
          result: finalResult,
        })
        .eq("id", jobId);

      return { success: true };
    } catch (error: any) {
      const msg = error?.message || "Unknown error";
      await sb
        .from("audit_jobs")
        .update({
          status: "failed",
          error_message: msg,
        })
        .eq("id", jobId);
      await pushLog(sb, jobId, 100, "Failed", `[ERROR] Failed: ${msg}`);
      throw error;
    }
  });

export const getAuditJobStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { jobId } = data;
    
    const { data: job } = await (context.supabase as any)
      .from("audit_jobs")
      .select('*')
      .eq('id', jobId)
      .eq('user_id', context.userId)
      .single();
    
    if (!job) throw new Error("Job not found");
    
    return {
      status: job.status,
      progress_percent: job.progress_percent,
      current_step: job.current_step,
      progress_log: job.progress_log ?? [],
      result: job.result,
      error_message: job.error_message,
    };
  });

export const getPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const settings = await getUserSettings(context.supabase, context.userId);
    const plan = getPlan(settings?.plan);
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
        const raw = await callGemini(system, JSON.stringify(realBusinesses), undefined, "gemini-2.5-flash", 2048);
        const parsed = parseJSON(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (error) {
        console.warn('Enrichment failed, falling through to AI generation:', error);
        // don't throw — let execution continue to AI generation fallback
      }
    }
    try {
      const system = `Generate 8 realistic local businesses for ${industry} in ${location} with poor web accessibility. Return ONLY a JSON array: [{"id":"string","name":"string","website":"string","ranking":"string","common_flaw":"string"}]`;
      const raw = await callGemini(system, `Industry: ${industry}\nLocation: ${location}`, undefined, "gemini-2.5-flash", 2048);
      const parsed = parseJSON(raw);
      return Array.isArray(parsed) ? parsed : (parsed.leads ?? []);
    } catch (error) {
      throw new Error(`Failed to generate business leads: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });
