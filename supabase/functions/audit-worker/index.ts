// @ts-nocheck
// Background WCAG audit worker. Returns 202 immediately and runs in background
// via EdgeRuntime.waitUntil, streaming live progress into audit_jobs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cleanHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*style\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s*data-[\w-]+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJSON(s: string) {
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return {};
}

async function callGemini(systemPrompt: string, userPrompt: string, apiKey: string) {
  const key = (apiKey || GEMINI_KEY).trim();
  if (!key) throw new Error("Gemini API key not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 32768,
        },
      }),
    });
    if (r.ok) {
      const j = await r.json();
      return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    }
    if (r.status === 503 || r.status === 429) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    const txt = await r.text();
    throw new Error(`Gemini ${r.status}: ${txt.slice(0, 200)}`);
  }
  throw new Error("Gemini overloaded after 3 retries");
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  await admin.from("audit_jobs").update(patch).eq("id", jobId);
}

async function pushLog(jobId: string, message: string, percent: number, step: string) {
  const { data: job } = await admin
    .from("audit_jobs")
    .select("progress_log")
    .eq("id", jobId)
    .maybeSingle();
  const log = Array.isArray((job as any)?.progress_log) ? (job as any).progress_log : [];
  log.push({ ts: new Date().toISOString(), message });
  await updateJob(jobId, {
    progress_log: log,
    progress_percent: percent,
    current_step: step,
  });
}

const CATEGORIES = [
  {
    key: "perceivable",
    label: "Perceivable (images, contrast, media)",
    criteria: "1.1.1 alt text, 1.2.x captions/transcripts, 1.3.x structure, 1.4.x contrast/resize/reflow, color-only info, prefers-reduced-motion.",
  },
  {
    key: "operable",
    label: "Operable (keyboard, focus, navigation)",
    criteria: "2.1.x keyboard reachable & no traps, 2.2.x timing/auto-play, 2.4.x focus order/indicator/skip-link/link-text, 2.5.5 touch targets >=44x44px.",
  },
  {
    key: "understandable",
    label: "Understandable (forms, language, errors)",
    criteria: "3.1.x lang & abbreviations, 3.2.x consistent nav, 3.3.x form labels/errors/validation.",
  },
  {
    key: "robust",
    label: "Robust (ARIA, semantics, iframes)",
    criteria: "4.1.x valid HTML, ARIA roles/landmarks/widgets (modals, dropdowns, tabs, carousels, tooltips, accordions), iframe titles, headings, page title.",
  },
];

function buildCategoryPrompt(cat: typeof CATEGORIES[number], includeCodeFixes: boolean) {
  return `You are a senior WCAG 2.1 AA auditor specializing in the ${cat.label} category.

Audit ONLY the ${cat.key.toUpperCase()} category. Criteria covered: ${cat.criteria}

MANDATORY RULES:
- Return AT LEAST 12 violations for this single category. Every instance is a separate violation.
- Be extremely specific in "element_affected" (selector, class, id, aria attribute).
- Escalate severity for transactional elements (CTAs, forms, checkout) by one level.
- Include mobile-specific issues as [MOBILE] prefixed entries when relevant for this category.

Return ONLY JSON:
{
  "category_score": number (0-25, start at 25 and subtract: critical 6-8, serious 3-5, moderate 2-3, minor 1),
  "violations": [
    {
      "id": "kebab-case-id",
      "severity": "critical"|"serious"|"moderate"|"minor",
      "name": "Short title",
      "wcag_criterion": "WCAG X.X.X",
      "description": "Plain English problem",
      "element_affected": "Specific element/selector",
      "legal_impact": "EU EAA, ADA, AODA, UK Equality Act exposure",
      "fix_instructions": "Concrete fix",
      "estimated_fix_time": "X hours",
      "revenue_impact": "How it affects conversions/excludes users",
      "fix_difficulty": "easy"|"medium"|"hard",
      "screenshot_selector": "CSS selector"${includeCodeFixes ? `,
      "code_fix": "exact code snippet"` : ""}
    }
  ]
}`;
}

async function runAuditWork(jobId: string) {
  try {
    const { data: job } = await admin
      .from("audit_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");

    const userId = (job as any).user_id as string;
    const url = (job as any).url as string;

    const { data: settings } = await admin
      .from("settings")
      .select("plan, audits_used, gemini_api_key")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = ((settings as any)?.plan as string) || "free";
    const userApiKey = ((settings as any)?.gemini_api_key as string) || "";
    const includeCodeFixes = plan !== "free";
    const violationCap = plan === "free" ? 5 : Infinity;

    await updateJob(jobId, { status: "processing" });
    await pushLog(jobId, `Starting audit for ${url}`, 5, "Initializing audit...");

    // Fetch HTML
    let pageSnippet = "";
    await pushLog(jobId, "Fetching page HTML", 10, "Fetching website content...");
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(url, {
        headers: { "User-Agent": "AccessAuditAI/1.0 (WCAG Compliance Scanner)" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const html = await r.text();
      pageSnippet = cleanHtml(html).slice(0, 18000);
      await pushLog(jobId, `Fetched ${pageSnippet.length} chars of cleaned HTML`, 18, "Parsing HTML structure...");
    } catch (e) {
      pageSnippet = `(Could not fetch ${url}. Perform a thorough theoretical WCAG 2.1 AA audit based on the URL.)`;
      await pushLog(jobId, `Could not fetch site, falling back to theoretical audit`, 18, "Fallback: theoretical audit");
    }

    // Run 4 categories in parallel, streaming progress as each completes
    await pushLog(jobId, "Running 4 parallel WCAG category scans", 25, "Scanning WCAG categories...");

    const baseProgress = 25;
    const span = 60; // 25 -> 85
    let completed = 0;
    const userPrompt = `URL: ${url}\n\nHTML content:\n${pageSnippet}`;

    const categoryResults = await Promise.all(
      CATEGORIES.map(async (cat) => {
        try {
          const raw = await callGemini(buildCategoryPrompt(cat, includeCodeFixes), userPrompt, userApiKey);
          const parsed = parseJSON(raw);
          completed++;
          const pct = baseProgress + Math.round((completed / CATEGORIES.length) * span);
          await pushLog(
            jobId,
            `✓ ${cat.label}: found ${(parsed.violations ?? []).length} violations (score ${parsed.category_score ?? "?"}/25)`,
            pct,
            `Completed ${completed}/${CATEGORIES.length} category scans`,
          );
          return { key: cat.key, score: parsed.category_score ?? 15, violations: parsed.violations ?? [] };
        } catch (err: any) {
          completed++;
          const pct = baseProgress + Math.round((completed / CATEGORIES.length) * span);
          await pushLog(jobId, `⚠ ${cat.label} failed: ${err?.message ?? "error"}`, pct, `Category ${cat.key} skipped`);
          return { key: cat.key, score: 15, violations: [] };
        }
      }),
    );

    await pushLog(jobId, "Aggregating findings and computing scores", 88, "Processing results...");

    const category_scores: Record<string, number> = {};
    let allViolations: any[] = [];
    for (const r of categoryResults) {
      category_scores[r.key] = r.score;
      allViolations = allViolations.concat(r.violations);
    }
    // de-dup ids
    const seen = new Set<string>();
    allViolations = allViolations.map((v, i) => {
      let id = v.id || `${v.severity || "minor"}-${i}`;
      if (seen.has(id)) id = `${id}-${i}`;
      seen.add(id);
      return { ...v, id };
    });

    const overall_score = Math.min(
      100,
      Object.values(category_scores).reduce((a, b) => a + (Number(b) || 0), 0),
    );

    const limited = violationCap === Infinity ? allViolations : allViolations.slice(0, violationCap);

    await pushLog(jobId, `Saving audit (${limited.length} violations, score ${overall_score}/100)`, 94, "Saving results...");

    // increment audits_used
    await admin
      .from("settings")
      .update({ audits_used: ((settings as any)?.audits_used ?? 0) + 1 })
      .eq("user_id", userId);

    const { data: inserted, error: insertErr } = await admin
      .from("audits")
      .insert({
        user_id: userId,
        url,
        overall_score,
        category_scores,
        violations: limited,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    await updateJob(jobId, {
      status: "completed",
      progress_percent: 100,
      current_step: "Audit complete",
      result: {
        ...inserted,
        plan,
        totalViolationsFound: allViolations.length,
        violationsShown: limited.length,
        isLimited: plan === "free" && allViolations.length > limited.length,
      },
    });
    await pushLog(jobId, `🎉 Audit complete — ${limited.length} violations shown`, 100, "Done");
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error("[audit-worker] failed", message);
    try {
      const { data: job } = await admin
        .from("audit_jobs")
        .select("progress_log")
        .eq("id", jobId)
        .maybeSingle();
      const log = Array.isArray((job as any)?.progress_log) ? (job as any).progress_log : [];
      log.push({ ts: new Date().toISOString(), message: `❌ Error: ${message}` });
      await admin
        .from("audit_jobs")
        .update({
          status: "failed",
          error_message: message,
          progress_log: log,
          current_step: "Failed",
        })
        .eq("id", jobId);
    } catch {}
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { jobId } = await req.json();
    if (!jobId) return new Response(JSON.stringify({ error: "jobId required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    // @ts-ignore
    EdgeRuntime.waitUntil(runAuditWork(jobId));
    return new Response(JSON.stringify({ ok: true, jobId, status: "accepted" }), {
      status: 202,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Bad request" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
