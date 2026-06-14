import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runAudit } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScoreGauge } from "@/components/ScoreGauge";
import type { Violation } from "@/lib/audit-types";
import { toast } from "sonner";
import { ArrowRight, Loader2, ShieldCheck, ScanLine, Copy, Check, ChevronDown, ChevronUp, Code2, Lock, AlertTriangle, Zap, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlan, TIER } from "@/lib/tier.utils";

export const Route = createFileRoute("/_authenticated/audit")({
  component: NewAuditPage,
});

interface RecentRow {
  id: string; url: string; overall_score: number;
  violations: any[]; created_at: string; has_proposal: boolean;
}

function scorePill(n: number) {
  if (n >= 80) return "bg-success/15 text-success border-success/30";
  if (n >= 50) return "bg-warning/15 text-warning border-warning/30";
  return "bg-danger/15 text-danger border-danger/30";
}

function severityColor(s: string) {
  if (s === "critical") return "bg-danger/10 text-danger border-danger/20";
  if (s === "serious") return "bg-warning/10 text-warning border-warning/20";
  if (s === "moderate") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  return "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

function NewAuditPage() {
  const navigate = useNavigate();
  const auditFn = useServerFn(runAudit);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [audit, setAudit] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<RecentRow[]>([]);
  const [expandedViolationId, setExpandedViolationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [used, setUsed] = useState(0);

  // No website prospect mode
  const [noWebsite, setNoWebsite] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessIndustry, setBusinessIndustry] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchResult, setPitchResult] = useState<string | null>(null);

  const generatePitch = async () => {
    if (!businessName || !businessIndustry) return;
    setPitchLoading(true);
    setPitchResult(null);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_LOVABLE_API_KEY || ""}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert digital agency consultant writing a website creation pitch email. Be specific, data-driven, and persuasive. Under 200 words." },
            { role: "user", content: `Write a cold email pitch for a business called '${businessName}' in the '${businessIndustry}' industry that has NO website. Include: 80%+ of local consumers research online before buying, how missing a website hands market share to competitors, and offer a free 1-page homepage mockup concept. End with a call to action for a 15-minute call.` }
          ]
        })
      });
      const json = await res.json();
      setPitchResult(json?.choices?.[0]?.message?.content ?? "Failed to generate pitch");
    } catch {
      toast.error("Failed to generate pitch");
    }
    setPitchLoading(false);
  };

  // Bulk CSV state
  const [bulkUrls, setBulkUrls] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("audits")
      .select("id, url, overall_score, violations, created_at, has_proposal")
      .order("created_at", { ascending: false })
      .limit(8);
    if (data) setRows(data as any);
  };

  useEffect(() => {
    loadRecent();
    supabase.from("settings").select("plan, audits_used").maybeSingle().then(({ data }) => {
      if (data && 'plan' in data) setPlan((data as any).plan);
      if (data && 'audits_used' in data) setUsed((data as any).audits_used);
    });
  }, []);

  const currentPlan = getPlan(plan);
  const canCodeFix = TIER[currentPlan].codeFixes;
  const canBulkCsv = TIER[currentPlan].bulkCsv;
  const auditLimit = TIER[currentPlan].audits;
  const isUnlimited = auditLimit >= 999999;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setLoadingStep(0);
    setExpandedViolationId(null);
    
    const loadingSteps = [
      "Connecting to website...",
      "Loading page in headless browser...",
      "Mapping DOM structure and landmarks...",
      "Scanning images, icons & media for alt text...",
      "Testing color contrast across all text...",
      "Checking keyboard navigation & focus order...",
      "Auditing ARIA roles and semantic HTML...",
      "Cross-referencing 25+ WCAG 2.1 AA criteria...",
      "Compiling violations and writing your report...",
    ];
    
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1800);
    
    try {
      const result = await auditFn({ data: { url } });
      clearInterval(stepInterval);
      setLoadingStep(loadingSteps.length - 1);
      await new Promise((r) => setTimeout(r, 2000));
      setAudit(result);
      setUsed((u) => u + 1);
      const preset = new Set<string>(
        ((result.violations as unknown) as Violation[])
          .filter((v: any) => v.severity === "critical" || v.severity === "serious")
          .map((v: any) => v.id)
      );
      setSelected(preset);
      toast.success(`Audit complete — ${result.violationsShown} violations found`);
      loadRecent();
    } catch (err: any) {
      clearInterval(stepInterval);
      setLoadingStep(loadingSteps.length - 1);
      await new Promise((r) => setTimeout(r, 2000));
      toast.error(err.message ?? "Audit failed");
    } finally { 
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedViolationId(expandedViolationId === id ? null : id);
  };

  const copyToClipboard = async (code: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success("Code snippet copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const goProposal = (row?: RecentRow) => {
    const a = row ?? audit;
    if (!a) return;
    const violations = row
      ? row.violations
      : ((audit.violations as unknown) as Violation[]).filter((v: any) => selected.has(v.id));
    sessionStorage.setItem("proposal_seed", JSON.stringify({
      auditId: a.id, url: a.url, score: a.overall_score, violations,
    }));
    navigate({ to: "/proposal" });
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canBulkCsv) { toast.error("Upgrade to Agency ($99/mo) for bulk CSV upload"); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const urls = text.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("http"));
    if (urls.length === 0) { toast.error("No valid URLs found in CSV"); return; }
    if (urls.length > 20) { toast.error("Max 20 URLs per batch"); return; }
    setBulkUrls(urls);
    setBulkLoading(true);
    setBulkProgress(0);
    toast.info(`Starting bulk audit of ${urls.length} URLs...`);
    for (let i = 0; i < urls.length; i++) {
      try {
        await auditFn({ data: { url: urls[i] } });
        setBulkProgress(i + 1);
      } catch {
        // continue on individual failures
      }
    }
    setBulkLoading(false);
    setBulkUrls([]);
    toast.success(`Bulk audit complete — ${urls.length} sites processed`);
    loadRecent();
  };

  return (
    <div className="animate-slide-up space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl">New Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a client's website URL to run a full WCAG 2.1 compliance scan.
          </p>
        </div>
        {/* Usage indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/40 border border-border px-3 py-1.5 rounded-md">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>
            {isUnlimited ? "Unlimited audits" : `${used} / ${auditLimit} audits used`}
          </span>
          <span className={cn(
            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full",
            currentPlan === "business" ? "bg-violet-500/20 text-violet-300" :
            currentPlan === "agency" ? "bg-blue-500/20 text-blue-300" :
            currentPlan === "starter" ? "bg-emerald-500/20 text-emerald-300" :
            "bg-zinc-500/20 text-zinc-400"
          )}>{currentPlan}</span>
        </div>
      </header>

      {/* Free tier warning banner */}
      {currentPlan === "free" && used >= 2 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 flex-1">
            {used >= 3
              ? "You've used all 3 free audits this month. Upgrade to Starter ($49/mo) for 20 audits."
              : `${3 - used} free audit${3 - used === 1 ? "" : "s"} remaining this month.`}
          </p>
          <Link to="/settings" className="text-xs font-semibold text-amber-300 hover:text-amber-100 shrink-0">Upgrade →</Link>
        </div>
      )}

      {/* URL bar */}
      <form onSubmit={submit} className="card-elevated p-1.5 flex items-stretch gap-1.5">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourclient.com.au"
          className="flex-1 h-[52px] bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-[52px] inline-flex items-center px-5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanLine className="h-4 w-4 mr-2" />}
          Run Audit
          {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
        </button>
      </form>

      {/* Loading progress indicator */}
      {loading && (
        <div className="card-elevated p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {["Connecting to website...", "Loading page in headless browser...", "Mapping DOM structure and landmarks...", "Scanning images, icons & media for alt text...", "Testing color contrast across all text...", "Checking keyboard navigation & focus order...", "Auditing ARIA roles and semantic HTML...", "Cross-referencing 25+ WCAG 2.1 AA criteria...", "Compiling violations and writing your report..."][loadingStep]}
                </span>
                <span className="text-xs text-muted-foreground">{Math.round((loadingStep + 1) / 6 * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${((loadingStep + 1) / 6) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            {loadingStep === 0 && "Establishing a secure connection to the target website to begin the scan..."}
            {loadingStep === 1 && "Rendering the page exactly as a real visitor would see it, including dynamic content..."}
            {loadingStep === 2 && "Building a map of headings, landmarks, and the document outline to check semantic structure..."}
            {loadingStep === 3 && "Checking every image, icon, and media element for missing or meaningless alt text (WCAG 1.1.1)..."}
            {loadingStep === 4 && "Measuring color contrast ratios across all text and UI components against the 4.5:1 AA threshold..."}
            {loadingStep === 5 && "Simulating keyboard-only navigation to test focus order, skip links, and visible focus indicators..."}
            {loadingStep === 6 && "Inspecting ARIA roles, labels, and landmark regions used by screen readers and assistive tech..."}
            {loadingStep === 7 && "Cross-referencing every finding against 25+ WCAG 2.1 AA success criteria across all four principles..."}
            {loadingStep === 8 && "Scoring each category, prioritizing violations by severity, and assembling your compliance report..."}
          </div>
        </div>
      )}

      {/* Bulk CSV upload — Agency+ */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-muted-foreground">Audits check 25+ WCAG criteria across all compliance categories.</p>
        <div className="ml-auto">
          {canBulkCsv ? (
            <label className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors">
              <Upload className="h-3.5 w-3.5" />
              {bulkLoading ? `Processing ${bulkProgress}/${bulkUrls.length}...` : "Bulk CSV upload"}
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} disabled={bulkLoading} />
            </label>
          ) : (
            <Link to="/settings" className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md border border-border/50 text-xs text-muted-foreground/50 hover:border-amber-500/40 hover:text-amber-400 transition-colors">
              <Lock className="h-3 w-3" />
              Bulk CSV (Agency+)
            </Link>
          )}
        </div>
      </div>

      {/* Bulk progress bar */}
      {bulkLoading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Bulk audit in progress...</span>
            <span>{bulkProgress} / {bulkUrls.length}</span>
          </div>
          <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(bulkProgress / bulkUrls.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Results Section */}
      {audit && (
        <section className="space-y-6 animate-fade-in">
          <ScoreGauge score={audit.overall_score} />

          {/* Limited violations banner for free users */}
          {audit.isLimited && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-violet-500/30 bg-violet-500/10">
              <Zap className="h-4 w-4 text-violet-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-300">
                  {audit.totalViolationsFound} violations found — showing 5 of {audit.totalViolationsFound}
                </p>
                <p className="text-xs text-violet-400/80 mt-0.5">
                  Upgrade to Starter ($49/mo) to see all violations and generate proposals.
                </p>
              </div>
              <Link to="/settings">
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white text-xs shrink-0">
                  Upgrade
                </Button>
              </Link>
            </div>
          )}

          <div className="card-elevated">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="label-eyebrow">Identified violations</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {canCodeFix
                    ? "Click any row to view AI code fixes. Copy and send to your developer."
                    : "Click any row to view issue details. Upgrade to Agency for AI code fixes."}
                </p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {(audit.violations as Violation[]).length} shown
              </span>
            </div>

            <div className="p-3 space-y-1">
              {((audit.violations as unknown) as Violation[]).map((v: any) => {
                const isExpanded = expandedViolationId === v.id;
                const fixDescription = v.fix_instructions || v.description || "Remediation needed.";
                const codeFixCode = v.code_fix || v.suggested_fix || null;

                return (
                  <div
                    key={v.id}
                    className={cn(
                      "rounded-md border border-transparent transition-all overflow-hidden",
                      isExpanded ? "bg-accent/30 border-border/60 shadow-inner" : "hover:bg-accent/40"
                    )}
                  >
                    {/* Row Header */}
                    <div
                      onClick={() => toggleExpand(v.id)}
                      className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                        <div className="mt-1 text-muted-foreground shrink-0">
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{v.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded text-muted-foreground border border-border">
                              {v.wcag_criterion}
                            </span>
                            <span className={cn(
                              "text-[9px] uppercase px-1.5 py-0.5 rounded-full font-extrabold tracking-wider border",
                              severityColor(v.severity)
                            )}>
                              {v.severity || "moderate"}
                            </span>
                            {v.estimated_fix_time && (
                              <span className="text-[10px] text-muted-foreground">
                                ~{v.estimated_fix_time}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canCodeFix && codeFixCode && (
                          <span className="text-[9px] text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5 rounded font-semibold">
                            AI FIX
                          </span>
                        )}
                        <Switch
                          checked={selected.has(v.id)}
                          onCheckedChange={(checked) => {
                            setSelected((s) => {
                              const n = new Set(s);
                              checked ? n.add(v.id) : n.delete(v.id);
                              return n;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    {/* Expanded drawer */}
                    {isExpanded && (
                      <div className="px-10 pb-4 pt-1 border-t border-border/40 space-y-3 bg-slate-950/20">

                        {/* Issue description */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Issue:</span>
                          <p className="text-xs text-muted-foreground leading-relaxed">{fixDescription}</p>
                        </div>

                        {/* Legal impact */}
                        {v.legal_impact && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Legal exposure:</span>
                            <p className="text-xs text-amber-400/80 leading-relaxed">{v.legal_impact}</p>
                          </div>
                        )}

                        {/* Element affected */}
                        {v.element_affected && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Element affected:</span>
                            <code className="block text-[11px] font-mono p-2 rounded bg-background/80 border border-border text-amber-300/90 break-all">
                              {v.element_affected}
                            </code>
                          </div>
                        )}

                        {/* Code fix — Agency/Business only */}
                        {canCodeFix ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <Code2 size={12} /> AI Code Fix:
                              </span>
                              {codeFixCode && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => copyToClipboard(codeFixCode, v.id, e)}
                                  className="h-7 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-border/40"
                                >
                                  {copiedId === v.id ? (
                                    <><Check size={12} className="mr-1 text-emerald-400" /> Copied</>
                                  ) : (
                                    <><Copy size={12} className="mr-1" /> Copy Fix</>
                                  )}
                                </Button>
                              )}
                            </div>
                            {codeFixCode ? (
                              <div className="relative rounded-md overflow-hidden border border-border bg-slate-950">
                                <pre className="p-3.5 overflow-x-auto text-xs font-mono text-emerald-400 leading-normal">
                                  <code>{codeFixCode}</code>
                                </pre>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                No code fix available for this violation type — see fix instructions above.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-3 rounded-md border border-violet-500/30 bg-violet-500/10">
                            <Lock className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                            <p className="text-xs text-violet-300">
                              AI code fixes available on <Link to="/settings" className="underline font-semibold">Agency ($99/mo)</Link> and above.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            onClick={() => goProposal()}
            disabled={!TIER[currentPlan].proposals}
            className={cn(
              "w-full h-11",
              TIER[currentPlan].proposals
                ? "bg-primary hover:bg-primary-hover text-primary-foreground"
                : "bg-accent text-muted-foreground cursor-not-allowed"
            )}
          >
            {TIER[currentPlan].proposals ? (
              <>Generate proposal from {selected.size} violation{selected.size === 1 ? "" : "s"}<ArrowRight className="h-4 w-4 ml-2" /></>
            ) : (
              <><Lock className="h-4 w-4 mr-2" />Proposals available on Starter ($49/mo)</>
            )}
          </Button>
        </section>
      )}

      {/* Recent audits */}
      <section className="space-y-4">
        <p className="label-eyebrow">Recent audits</p>

        {rows.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <div className="h-12 w-12 mx-auto rounded-md bg-accent grid place-items-center">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No audits yet. Paste a URL above to run your first scan.</p>
          </div>
        ) : (
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 label-eyebrow">Website</th>
                    <th className="text-left px-5 py-3 label-eyebrow">Score</th>
                    <th className="text-left px-5 py-3 label-eyebrow">Violations</th>
                    <th className="text-left px-5 py-3 label-eyebrow">Date</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs max-w-[260px] truncate text-muted-foreground">{r.url}</td>
                      <td className="px-5 py-3">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded border font-mono", scorePill(r.overall_score))}>
                          {r.overall_score}/100
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{(r.violations as any[]).length}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Link to="/history" className="h-8 inline-flex items-center px-3 rounded-md border border-border text-xs hover:bg-accent transition-colors">
                            View
                          </Link>
                          <button
                            onClick={() => goProposal(r)}
                            disabled={!TIER[currentPlan].proposals}
                            className={cn(
                              "h-8 inline-flex items-center px-3 rounded-md text-xs transition-colors",
                              TIER[currentPlan].proposals
                                ? "bg-primary hover:bg-primary-hover text-primary-foreground"
                                : "bg-accent text-muted-foreground cursor-not-allowed"
                            )}
                          >
                            {TIER[currentPlan].proposals ? "Proposal" : <><Lock className="h-3 w-3 mr-1" />Locked</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}