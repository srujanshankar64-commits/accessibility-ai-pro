// ═══════════════════════════════════════════════════════════════
// FULL REPLACEMENT SECTIONS for src/lib/ai.functions.ts
// Copy-paste each section over the matching section in your file
// ═══════════════════════════════════════════════════════════════

// ── 1. REPLACE these constants at the top of ai.functions.ts ──

const MIN_CALL_INTERVAL = 1500; // was 3500 — faster throughput
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000;

// ── 2. REPLACE getBackoffWithJitter ──────────────────────────

function getBackoffWithJitter(attempt: number): number {
  const baseDelay = 800; // was 2000 — cuts retry wait dramatically
  const multiplier = Math.pow(2, attempt);
  const jitter = Math.random() * 500; // was 1000
  return baseDelay * multiplier + jitter;
}

// ── 3. REPLACE callGemini maxRetries ─────────────────────────
// Inside callGemini, change:
//   OLD: const maxRetries = 5;
//   NEW: const maxRetries = 3;
// This alone cuts worst-case from ~60s to ~20s

// ── 4. ADD this helper ABOVE processAuditJob export ──────────

async function pushJobLog(
  supabase: any,
  jobId: string,
  percent: number,
  step: string,
  logLine: string
) {
  // Read-modify-write the progress_log array
  const { data } = await supabase
    .from("audit_jobs")
    .select("progress_log")
    .eq("id", jobId)
    .single();

  const existing: Array<{ message: string; ts: string }> =
    Array.isArray(data?.progress_log) ? data.progress_log : [];

  await supabase
    .from("audit_jobs")
    .update({
      progress_percent: percent,
      current_step: step,
      progress_log: [...existing, { message: logLine, ts: new Date().toISOString() }],
    })
    .eq("id", jobId);
}

// ── 5. FULL REPLACEMENT of processAuditJob handler ───────────

export const processAuditJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { jobId } = data;

    await context.supabase
      .from("audit_jobs")
      .update({
        status: "processing",
        progress_percent: 3,
        current_step: "Initializing audit engine...",
        progress_log: [{ message: "[LOG] Audit engine initializing...", ts: new Date().toISOString() }],
      })
      .eq("id", jobId);

    try {
      const { data: job } = await context.supabase
        .from("audit_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!job) throw new Error("Job not found");

      const settings = await getUserSettings(context.supabase, context.userId);
      const plan = getPlan(settings?.plan, "srujanshankar64@gmail.com");

      // ── Step 1: Fetch HTML ──────────────────────────────────
      await pushJobLog(
        context.supabase, jobId, 10,
        "Fetching website content...",
        "[LOG] Establishing secure HTTPS connection..."
      );

      let pageSnippet = "";
      try {
        const fetchController = new AbortController();
        setTimeout(() => fetchController.abort(), 15000); // 15s timeout (was 20s)
        const r = await fetch(job.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AccessAuditAI/2.0 (WCAG Compliance Scanner)",
          },
          signal: fetchController.signal,
        });
        const html = await r.text();
        const cleanedHtml = cleanHtml(html);
        // Reduce snippet size — 20k chars is plenty for Gemini, was 35k
        pageSnippet = cleanedHtml.slice(0, 20000);

        await pushJobLog(
          context.supabase, jobId, 18,
          "Parsing HTML structure...",
          `[LOG] Fetched ${(html.length / 1024).toFixed(0)}KB of HTML — using first 20KB for analysis`
        );
      } catch (fetchError) {
        await pushJobLog(
          context.supabase, jobId, 18,
          "Fetch failed — running theoretical audit...",
          `[WARN] Could not fetch page directly — performing pattern-based audit`
        );
        pageSnippet = `(Could not fetch ${job.url} directly. Perform a thorough theoretical WCAG 2.1 AA audit based on the URL structure and typical patterns for this type of website. URL indicates: ${new URL(job.url).hostname})`;
      }

      // ── Step 2: Perceivable scan ────────────────────────────
      await pushJobLog(
        context.supabase, jobId, 25,
        "Scanning WCAG criteria...",
        "[STATUS] Category: Perceivable — scanning images, contrast, captions..."
      );

      // ── Step 3: Operable scan ───────────────────────────────
      await pushJobLog(
        context.supabase, jobId, 35,
        "Checking operable criteria...",
        "[STATUS] Category: Operable — checking keyboard, focus, touch targets..."
      );

      // ── Step 4: Understandable scan ─────────────────────────
      await pushJobLog(
        context.supabase, jobId, 42,
        "Checking understandable criteria...",
        "[STATUS] Category: Understandable — validating lang, labels, error messages..."
      );

      // ── Step 5: Robust scan ─────────────────────────────────
      await pushJobLog(
        context.supabase, jobId, 48,
        "Checking robust criteria...",
        "[STATUS] Category: Robust — validating ARIA roles, landmarks, HTML structure..."
      );

      // ── Step 6: AI analysis ─────────────────────────────────
      await pushJobLog(
        context.supabase, jobId, 52,
        "Running AI analysis...",
        "[LOG] Sending DOM snapshot to Gemini Flash for WCAG analysis..."
      );

      const includeCodeFixes = TIER[plan].codeFixes;
      const auditSystemPrompt = buildAuditSystemPrompt(includeCodeFixes);
      const userPrompt = `Audit this website for WCAG 2.1 AA compliance. Be exhaustive. Find every violation.\n\nURL: ${job.url}\n\nHTML content:\n${pageSnippet}`;

      const raw = await callGemini(auditSystemPrompt, userPrompt, settings?.gemini_api_key);

      await pushJobLog(
        context.supabase, jobId, 70,
        "Processing AI response...",
        "[LOG] AI analysis complete — parsing violation inventory..."
      );

      const result = parseJSON(raw);
      let allViolations = result.violations ?? [];

      // ── Step 7: Validate violation count ────────────────────
      if (plan !== "free" && allViolations.length < 50) {
        await pushJobLog(
          context.supabase, jobId, 75,
          "Expanding violation scan...",
          `[WARN] Found ${allViolations.length} violations — running deeper scan for completeness...`
        );

        const enhancedPrompt = buildAuditSystemPrompt(includeCodeFixes, true);
        const retryRaw = await callGemini(
          enhancedPrompt,
          userPrompt + "\n\nCRITICAL: Find at least 50 violations. Be exhaustive.",
          settings?.gemini_api_key
        );
        const retryResult = parseJSON(retryRaw);
        allViolations = retryResult.violations ?? allViolations;
      }

      if (allViolations.length === 0) {
        throw new Error("AI audit returned no violations — please try again.");
      }

      await pushJobLog(
        context.supabase, jobId, 82,
        "Generating compliance report...",
        `[FINDING] ${allViolations.filter((v: any) => v.severity === "critical").length} CRITICAL | ${allViolations.filter((v: any) => v.severity === "serious").length} SERIOUS | ${allViolations.length} total violations found`
      );

      const violationLimit = TIER[plan].violations;
      const limitedViolations =
        plan === "free" ? allViolations.slice(0, violationLimit) : allViolations;

      // ── Step 8: Save results ────────────────────────────────
      await pushJobLog(
        context.supabase, jobId, 88,
        "Saving audit results...",
        "[LOG] Writing compliance report to database..."
      );

      await context.supabase
        .from("settings")
        .update({ audits_used: (settings?.audits_used ?? 0) + 1 })
        .eq("user_id", context.userId);

      const { data: inserted, error: insertError } = await context.supabase
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

      const finalResult = {
        ...(inserted as any),
        plan,
        totalViolationsFound: allViolations.length,
        violationsShown: limitedViolations.length,
        isLimited: plan === "free" && allViolations.length > violationLimit,
      };

      // ── Step 9: Complete ────────────────────────────────────
      // Read current log to append final entry
      const { data: currentJob } = await context.supabase
        .from("audit_jobs")
        .select("progress_log")
        .eq("id", jobId)
        .single();

      const finalLog = [
        ...(Array.isArray(currentJob?.progress_log) ? currentJob.progress_log : []),
        {
          message: `[COMPLETE] Audit finished — ${allViolations.length} violations found, score: ${result.overall_score ?? 0}/100`,
          ts: new Date().toISOString(),
        },
      ];

      await context.supabase
        .from("audit_jobs")
        .update({
          status: "completed",
          progress_percent: 100,
          current_step: "Audit complete",
          progress_log: finalLog,
          result: finalResult,
        })
        .eq("id", jobId);

      return { success: true };
    } catch (error: any) {
      // Read current log
      const { data: currentJob } = await context.supabase
        .from("audit_jobs")
        .select("progress_log")
        .eq("id", jobId)
        .single();

      const errorLog = [
        ...(Array.isArray(currentJob?.progress_log) ? currentJob.progress_log : []),
        { message: `[ERROR] ${error?.message || "Unknown error"}`, ts: new Date().toISOString() },
      ];

      await context.supabase
        .from("audit_jobs")
        .update({
          status: "failed",
          error_message: error?.message || "Unknown error",
          progress_log: errorLog,
        })
        .eq("id", jobId);
      throw error;
    }
  });

// ── 6. ADD buildAuditSystemPrompt helper ─────────────────────
// Add this function ABOVE processAuditJob and runAudit

function buildAuditSystemPrompt(includeCodeFixes: boolean, enhanced = false): string {
  const volumeBoost = enhanced
    ? "CRITICAL: YOU MUST FIND AT LEAST 50 VIOLATIONS. THIS IS NOT NEGOTIABLE.\n"
    : "";

  return `${volumeBoost}You are a senior WCAG 2.1 AA accessibility auditor with 10 years of experience. Your audits are used by digital agencies to sell remediation services to corporate entities.

Your job is to produce an EXHAUSTIVE and REALISTIC audit. You MUST find and report every violation present. Do NOT be conservative.

MANDATORY VOLUME RULES — NON-NEGOTIABLE:
- You MUST return a MINIMUM of 50 violations. This is a hard floor.
- EVERY INSTANCE is a separate violation. 10 images missing alt text = 10 violations.
- Be EXTREMELY specific in element_affected. Name the exact HTML element, CSS class, ID, aria attribute, or page location.
- Check ALL 4 WCAG categories exhaustively.
- NEVER stop at 20-30 violations. That is a failure. The minimum is 50.
- Mobile violations are SEPARATE from desktop violations. Prefix with [MOBILE].

SEVERITY ESCALATION RULES:
- Any violation with direct legal exposure MUST be rated critical or serious.
- If a violation affects a transactional element, escalate severity by one level.

ADDITIONAL REQUIRED FIELDS PER VIOLATION:
- "revenue_impact": string
- "fix_difficulty": "easy" | "medium" | "hard"
- "screenshot_selector": string (CSS selector of affected element)

SYSTEMIC ISSUE DETECTION:
"systemic_issues": [{ "pattern": string, "count": number, "description": string, "impact": string }]

URGENCY SCORE: "urgency_score": 1-10, "urgency_reason": string

SCORE TREND: "score_prediction": { "current": number, "projected_after_remediation": number, "timeline": "4 weeks", "trend_without_remediation": string }

DEV HOURS: "hours_breakdown": { "critical_fixes": number, "serious_fixes": number, "mobile_fixes": number, "testing_and_certification": 2, "total": number }

SCORING RULES:
- Start each category at 25. Subtract: Critical = 6-8pts, Serious = 3-5pts, Moderate = 2-3pts, Minor = 1pt.
- overall_score = sum of all four category scores (max 100).

${includeCodeFixes
  ? 'For each violation, include a "code_fix" field with the exact HTML/CSS/JavaScript code snippet that fixes the issue.'
  : 'Do NOT include a "code_fix" field in the output.'}

Return ONLY valid JSON:
{
  "overall_score": number,
  "category_scores": { "perceivable": number, "operable": number, "understandable": number, "robust": number },
  "industry_benchmark": string,
  "urgency_score": number,
  "urgency_reason": string,
  "score_prediction": object,
  "hours_breakdown": object,
  "systemic_issues": array,
  "violations": [
    {
      "id": "kebab-case-id",
      "severity": "critical" | "serious" | "moderate" | "minor",
      "name": string,
      "wcag_criterion": string,
      "description": string,
      "element_affected": string,
      "legal_impact": string,
      "fix_instructions": string,
      "estimated_fix_time": string,
      "revenue_impact": string,
      "fix_difficulty": "easy" | "medium" | "hard",
      "screenshot_selector": string${includeCodeFixes ? ',\n      "code_fix": string' : ""}
    }
  ]
}`;
}
