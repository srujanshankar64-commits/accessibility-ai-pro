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
import { ArrowRight, Loader2, ShieldCheck, ScanLine, Copy, Check, ChevronDown, ChevronUp, Code2, Lock, AlertTriangle, Zap, Upload, Share2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlan, TIER } from "@/lib/tier.utils";

type AuditState = 
  | "IDLE" 
  | "INITIALIZING" 
  | "SCANNING_CORE_CRITERIA" 
  | "ANALYZING_ACCESSIBILITY_BARRIERS" 
  | "GENERATING_PROPOSAL" 
  | "COMPLETED";

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
  return "bg-[#f5f5f7] text-[#6e6e73] border-[#d2d2d7]";
}

function NewAuditPage() {
  const navigate = useNavigate();
  const auditFn = useServerFn(runAudit);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditState, setAuditState] = useState<AuditState>("IDLE");
  const [progress, setProgress] = useState(0);
  const [audit, setAudit] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<RecentRow[]>([]);
  const [expandedViolationId, setExpandedViolationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [showUpsell, setShowUpsell] = useState(false);
  const [used, setUsed] = useState(0);

  // No website prospect mode
  const [noWebsite, setNoWebsite] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessIndustry, setBusinessIndustry] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchResult, setPitchResult] = useState<string | null>(null);

  const [businessCity, setBusinessCity] = useState("");

  // Business Elite features
  const [multiPageCrawlEnabled, setMultiPageCrawlEnabled] = useState(false);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [crawledPages, setCrawledPages] = useState<string[]>([]);
  const [autoReauditEnabled, setAutoReauditEnabled] = useState(false);

  const generatePitch = async () => {
    if (!businessName || !businessIndustry) return;
    setPitchLoading(true);
    setPitchResult(null);
    try {
      const cityContext = businessCity ? ` based in ${businessCity}` : "";
      
      // Use the same API key priority logic as callGemini
      const defaultGeminiKey = typeof process !== 'undefined' ? process.env?.GOOGLE_GEMINI_API_KEY : null;
      const envLovableKey = (typeof process !== 'undefined' && process.env?.VITE_LOVABLE_API_KEY) || 
                          (typeof process !== 'undefined' && process.env?.LOVABLE_API_KEY);
      
      let res;
      let json;
      
      // Try default Gemini API key first (highest priority)
      if (defaultGeminiKey) {
        try {
          res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + defaultGeminiKey, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `You are an expert digital agency consultant writing a website creation pitch email. Be specific, data-driven, and persuasive. Under 200 words.\n\nWrite a cold email pitch for a business called '${businessName}'${cityContext} in the '${businessIndustry}' industry that has NO website. Include: 80%+ of local consumers research online before buying, how missing a website hands market share to competitors, and offer a free 1-page homepage mockup concept. End with a call to action for a 15-minute call.` }] }
              ],
            }),
          });
          if (res.ok) {
            json = await res.json();
            setPitchResult(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Failed to generate pitch");
            setPitchLoading(false);
            return;
          }
        } catch (error) {
          console.error("Default Gemini API key failed for pitch:", error);
        }
      }
      
      // Fallback to Lovable API
      if (envLovableKey) {
        res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${envLovableKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are an expert digital agency consultant writing a website creation pitch email. Be specific, data-driven, and persuasive. Under 200 words." },
              { role: "user", content: `Write a cold email pitch for a business called '${businessName}'${cityContext} in the '${businessIndustry}' industry that has NO website. Include: 80%+ of local consumers research online before buying, how missing a website hands market share to competitors, and offer a free 1-page homepage mockup concept. End with a call to action for a 15-minute call.` }
            ]
          })
        });
        json = await res.json();
        setPitchResult(json?.choices?.[0]?.message?.content ?? "Failed to generate pitch");
      } else {
        setPitchResult("AI gateway not configured. Please contact support.");
      }
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
    let mounted = true;
    
    const loadInitialData = async () => {
      try {
        if (mounted) {
          await loadRecent();
        }
        if (mounted) {
          const { data } = await supabase.from("settings").select("plan, audits_used").maybeSingle();
          if (data && 'plan' in data) setPlan((data as any).plan);
          if (data && 'audits_used' in data) setUsed((data as any).audits_used);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
    
    loadInitialData();
    
    return () => {
      mounted = false;
    };
  }, []);

  const currentPlan = getPlan(plan);
  const canCodeFix = TIER[currentPlan].codeFixes;
  const canBulkCsv = TIER[currentPlan].bulkCsv;
  const canMultiPageCrawl = TIER[currentPlan].multiPageCrawl;
  const canCompetitorBenchmark = TIER[currentPlan].competitorBenchmark;
  const auditLimit = TIER[currentPlan].audits;
  const isUnlimited = auditLimit >= 999999;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setExpandedViolationId(null);
    setAuditState("INITIALIZING");
    setProgress(0);
    
    // Run competitor audit if provided (Business Elite)
    let competitorAuditId = null;
    if (canCompetitorBenchmark && competitorUrl) {
      try {
        toast.info("Running competitor benchmark audit (this may take 30-60 seconds)...");
        const compResult = await auditFn({ data: { url: competitorUrl } });
        if (compResult?.data?.id) {
          competitorAuditId = compResult.data.id;
          toast.success("Competitor benchmark complete!");
        }
      } catch (err: any) {
        console.error("Competitor audit failed:", err);
        toast.error(`Competitor audit failed: ${err.message || 'Unable to audit competitor URL'}`);
      }
    }

    // Run multi-page crawl if enabled (Business Elite)
    let parentAuditId = null;
    if (canMultiPageCrawl && multiPageCrawlEnabled) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("User not authenticated");
        
        const { crawlSiteServer, createParentAudit, linkChildAudit, updateParentAudit } = await import("@/lib/crawler");
        toast.info("Starting multi-page crawl (this may take 30-60 seconds)...");
        const crawledPages = await crawlSiteServer({ data: { url, depth: 2 } });
        if (crawledPages.length > 1) {
          parentAuditId = await createParentAudit(user.id, url);
          toast.info(`Found ${crawledPages.length} pages. Auditing up to 10 pages...`);
          // Child audits will be created for each crawled page
          for (let i = 0; i < Math.min(crawledPages.length - 1, 10); i++) {
            const page = crawledPages[i + 1];
            try {
              toast.info(`Auditing page ${i + 1}/${Math.min(crawledPages.length - 1, 10)}: ${page.url}`);
              const childResult = await auditFn({ data: { url: page.url } });
              if (childResult?.data?.id) {
                await linkChildAudit(parentAuditId, childResult.data.id);
              }
            } catch (err) {
              console.error("Child audit failed for", page.url, err);
              toast.error(`Failed to audit ${page.url}`);
            }
          }
          await updateParentAudit(parentAuditId);
          toast.success("Multi-page crawl complete!");
        } else {
          toast.info("Only 1 page found, running single-page audit");
        }
      } catch (err) {
        console.error("Multi-page crawl failed:", err);
        toast.error("Multi-page crawl failed, falling back to single-page audit");
      }
    }
    
    let currentProgress = 0;
    const stepInterval = setInterval(() => {
      currentProgress += (Math.random() * 5 + 2);
      if (currentProgress > 99) currentProgress = 99;
      
      setProgress(Math.min(Math.round(currentProgress), 99));

      if (currentProgress >= 10 && currentProgress < 50) {
        setAuditState("SCANNING_CORE_CRITERIA");
      } else if (currentProgress >= 50 && currentProgress < 90) {
        setAuditState("ANALYZING_ACCESSIBILITY_BARRIERS");
      } else if (currentProgress >= 90) {
        setAuditState("GENERATING_PROPOSAL");
      }
    }, 800);
    
    try {
      const result = await auditFn({ data: { url } });
      clearInterval(stepInterval);
      setProgress(100);
      setAuditState("COMPLETED");
      setAudit(result);
      setUsed((u) => u + 1);
      
      // Store competitor benchmark data if competitor audit was run
      if (competitorAuditId && result?.data?.id) {
        try {
          await supabase
            .from('audits')
            .update({
              competitor_audit_id: competitorAuditId,
              competitor_url: competitorUrl,
              has_competitor_benchmark: true,
            } as any)
            .eq('id', result.data.id);
        } catch (err) {
          console.error("Failed to store competitor data (migration not run yet):", err);
        }
      }
      
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
      await new Promise((r) => setTimeout(r, 2000));
      toast.error(err.message ?? "Audit failed");
      setAuditState("IDLE");
      setProgress(0);
    } finally { 
      setLoading(false);
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

  const goProposal = async (row?: RecentRow) => {
    const a = row ?? audit;
    if (!a) return;
    const violations = row
      ? row.violations
      : ((audit.violations as unknown) as Violation[]).filter((v: any) => selected.has(v.id));
    
    // Fetch competitor data if available
    let competitorData = null;
    if (a.id) {
      const { data: auditData } = await supabase
        .from('audits')
        .select('competitor_audit_id, competitor_url, has_competitor_benchmark')
        .eq('id', a.id)
        .maybeSingle();
      
      if ((auditData as any)?.has_competitor_benchmark && (auditData as any)?.competitor_audit_id) {
        const { data: compAudit } = await supabase
          .from('audits')
          .select('overall_score, violations')
          .eq('id', (auditData as any).competitor_audit_id)
          .maybeSingle();
        
        if (compAudit) {
          competitorData = {
            url: (auditData as any).competitor_url,
            score: compAudit.overall_score,
            violations: Array.isArray(compAudit.violations) ? compAudit.violations.length : 0,
          };
        }
      }
    }
    
    sessionStorage.setItem("proposal_seed", JSON.stringify({
      auditId: a.id, url: a.url, score: a.overall_score, violations, competitorData,
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
            currentPlan === "business" ? "bg-blue-500/20 text-blue-300" :
            currentPlan === "agency" ? "bg-purple-500/20 text-purple-300" :
            currentPlan === "starter" ? "bg-emerald-500/20 text-emerald-300" :
            "bg-slate-700 text-slate-300"
          )}>{currentPlan}</span>
          {!isUnlimited && used >= auditLimit - 2 && currentPlan === "starter" && (
            <span className="text-[9px] font-bold text-amber-400">⚠️ Near limit</span>
          )}
        </div>
      </header>

      {/* Free tier warning banner */}
      {((currentPlan === "free" && used >= 2) || (currentPlan === "starter" && used >= 18)) && (
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
      <div className="space-y-2">
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

        {/* Business Elite Options */}
        {(canMultiPageCrawl || canCompetitorBenchmark) && (
          <div className="card-elevated p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Business Elite Options</span>
              <span className="text-[10px] text-primary font-medium">Business Tier</span>
            </div>
            
            {canMultiPageCrawl && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Multi-page crawl (up to 50 pages)</span>
                </div>
                <Switch
                  checked={multiPageCrawlEnabled}
                  onCheckedChange={setMultiPageCrawlEnabled}
                  disabled={loading}
                />
              </div>
            )}
            
            {canCompetitorBenchmark && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Competitor benchmark</span>
                </div>
                <input
                  type="url"
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  placeholder="https://competitor.com"
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={loading}
                />
              </div>
            )}
            
            {TIER[currentPlan].complianceVelocity && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Auto re-audits (monthly)</span>
                </div>
                <Switch
                  checked={autoReauditEnabled}
                  onCheckedChange={setAutoReauditEnabled}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-start px-2">
          <Link to="/proposal" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 font-medium">
             Prospect has no website? Jump straight to proposal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Loading progress indicator */}
      {(auditState !== "IDLE" && auditState !== "COMPLETED") && (
        <div className="card-elevated p-6 space-y-4 animate-fade-in" aria-live="polite">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {auditState === "INITIALIZING" && "Initializing audit engine..."}
                  {auditState === "SCANNING_CORE_CRITERIA" && "Scanning core criteria..."}
                  {auditState === "ANALYZING_ACCESSIBILITY_BARRIERS" && "Analyzing accessibility barriers..."}
                  {auditState === "GENERATING_PROPOSAL" && "Generating remediation code..."}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{progress}%</span>
              </div>
              <div 
                className="h-2 w-full bg-accent rounded-full overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div 
                  className="h-full bg-primary"
                  style={{ 
                    width: `${progress}%`,
                    transition: "width 0.3s ease-in-out" 
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border/40">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">Audit Execution Log</p>
            <div className="space-y-1.5 text-xs font-mono bg-slate-950/5 dark:bg-slate-950/20 p-3 rounded-md border border-border/40">
              <div className={cn("flex items-center gap-2", progress >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground/50")}>
                 {progress >= 10 ? "✓" : "○"} Initializing audit engine...
              </div>
              <div className={cn("flex items-center gap-2", progress >= 10 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground/50")}>
                 {progress >= 50 ? "✓" : "○"} Scanned 25+ WCAG criteria
              </div>
              <div className={cn("flex items-center gap-2", progress >= 50 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground/50")}>
                 {progress >= 90 ? "✓" : "○"} Analyzed accessibility barriers and DOM structure
              </div>
              <div className={cn("flex items-center gap-2", progress >= 90 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground/50")}>
                 {progress === 100 ? "✓" : "○"} Compiling diagnostic data and remediation code...
              </div>
            </div>
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
            <div className="flex items-center gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50">
              <Zap className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-700">
                  {audit.totalViolationsFound} violations found — showing 5 of {audit.totalViolationsFound}
                </p>
                <p className="text-xs text-blue-600/80 mt-0.5">
                  Upgrade to Starter ($49/mo) to see all violations and generate proposals.
                </p>
              </div>
              <Link to="/settings">
                <Button size="sm" className="bg-[#1d1d1f] hover:opacity-80 text-white text-xs shrink-0">
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

            {/* Compliance Shield Embed - Business Tier */}
            {TIER[currentPlan].complianceShield && audit && (
              <div className="px-5 py-4 border-b border-border bg-primary/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">Compliance Shield Widget</p>
                  </div>
                  <span className="text-[10px] text-primary font-medium">Business Tier</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Add this embed code to your client's website footer to display a live compliance badge.
                  </p>
                  <div className="bg-background border border-border rounded-md p-3">
                    <code className="text-xs font-mono text-muted-foreground break-all">
                      {`<script src="https://accessibility-ai-pro.lovable.app/compliance-shield.js" data-audit-id="${audit.id}"></script>`}
                    </code>
                  </div>
                  <button
                    onClick={() => {
                      const code = `<script src="https://accessibility-ai-pro.lovable.app/compliance-shield.js" data-audit-id="${audit.id}"></script>`;
                      navigator.clipboard.writeText(code);
                      toast.success("Embed code copied to clipboard");
                    }}
                    className="text-xs text-primary hover:text-primary-hover flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy embed code
                  </button>
                </div>
              </div>
            )}

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
                      <div className="px-10 pb-4 pt-1 border-t border-border/40 space-y-3 bg-[#f5f5f7]">

                        {/* Issue description */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider block">Issue:</span>
                          <p className="text-xs text-muted-foreground leading-relaxed">{fixDescription}</p>
                        </div>

                        {/* Legal impact */}
                        {v.legal_impact && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider block">Legal exposure:</span>
                            <p className="text-xs text-[#b47a0a] leading-relaxed">{v.legal_impact}</p>
                          </div>
                        )}

                        {/* Element affected */}
                        {v.element_affected && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-wider block">Element affected:</span>
                            <code className="block text-[11px] font-mono p-2 rounded bg-background/80 border border-border text-[#b47a0a] break-all">
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
                                  className="h-7 px-2.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#e8e8ed] border border-border/40"
                                >
                                  {copiedId === v.id ? (
                                    <><Check size={12} className="mr-1 text-[#1a7f3c]" /> Copied</>
                                  ) : (
                                    <><Copy size={12} className="mr-1" /> Copy Fix</>
                                  )}
                                </Button>
                              )}
                            </div>
                            {codeFixCode ? (
                              <div className="relative rounded-md overflow-hidden border border-border bg-[#f5f5f7]">
                                <pre className="p-3.5 overflow-x-auto text-xs font-mono text-[#1a7f3c] leading-normal">
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
                          <div className="flex items-center gap-2 p-3 rounded-md border border-blue-200 bg-blue-50">
                            <Lock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <p className="text-xs text-blue-700">
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
