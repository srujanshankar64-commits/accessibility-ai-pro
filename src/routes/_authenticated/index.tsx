import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runAudit } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Loader2, Eye, MousePointer2, Type, Code2, ChevronDown, Download, FileText } from "lucide-react";
import { ScoreGauge } from "@/components/ScoreGauge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Violation, AuditResult } from "@/lib/audit-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: NewAuditPage,
});

const STAGES = [
  "Fetching page content...",
  "Analyzing accessibility violations...",
  "Generating compliance report...",
];

const CATEGORIES = [
  { key: "perceivable", label: "Perceivable", icon: Eye },
  { key: "operable", label: "Operable", icon: MousePointer2 },
  { key: "understandable", label: "Understandable", icon: Type },
  { key: "robust", label: "Robust", icon: Code2 },
] as const;

function severityPill(sev: string) {
  const map: Record<string, string> = {
    critical: "bg-danger/15 text-danger border-danger/30",
    serious: "bg-warning/15 text-warning border-warning/30",
    moderate: "bg-primary/15 text-primary border-primary/30",
    minor: "bg-muted text-muted-foreground border-border",
  };
  return map[sev] ?? map.minor;
}

function NewAuditPage() {
  const navigate = useNavigate();
  const auditFn = useServerFn(runAudit);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [audit, setAudit] = useState<(AuditResult & { id: string; url: string; created_at: string }) | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true); setStage(0); setAudit(null); setSelected(new Set());
    const stages = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2000);
    try {
      const result = await auditFn({ data: { url } });
      setAudit({
        id: result.id,
        url: result.url,
        created_at: result.created_at,
        overall_score: result.overall_score,
        category_scores: result.category_scores as any,
        violations: result.violations as any,
      });
      // preselect critical+serious
      const preset = new Set<string>(
        (result.violations as Violation[])
          .filter((v) => v.severity === "critical" || v.severity === "serious")
          .map((v) => v.id),
      );
      setSelected(preset);
      toast.success("Audit complete");
    } catch (err: any) {
      toast.error(err.message ?? "Audit failed");
    } finally {
      clearInterval(stages);
      setLoading(false);
    }
  };

  const toggleSel = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleExp = (id: string) => {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const goProposal = () => {
    if (!audit) return;
    const violations = (audit.violations as Violation[]).filter((v) => selected.has(v.id));
    sessionStorage.setItem("proposal_seed", JSON.stringify({
      auditId: audit.id, url: audit.url, score: audit.overall_score, violations,
    }));
    navigate({ to: "/app/proposal" });
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <header>
        <h1 className="font-display text-3xl">Audit a website</h1>
        <p className="mt-2 text-muted-foreground">
          Check your client's site for WCAG 2.1 violations and generate a proposal in 60 seconds.
        </p>
      </header>

      <div className="card-elevated p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="label-eyebrow">Client website URL</label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourclient.com"
              required
              className="font-mono h-12 text-base"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              We'll check for 50+ WCAG 2.1 AA violations across 4 categories.
            </p>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse-soft" style={{ width: `${((stage + 1) / STAGES.length) * 100}%`, transition: "width 0.6s" }} />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {STAGES[stage]}
              </div>
            </div>
          ) : (
            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Run Accessibility Audit
            </Button>
          )}
        </form>
      </div>

      {audit && (
        <section className="space-y-6 animate-slide-up">
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="card-elevated p-6 lg:col-span-2 flex flex-col items-center justify-center">
              <ScoreGauge score={audit.overall_score} />
              <p className="mt-6 font-mono text-xs text-muted-foreground truncate max-w-full">{audit.url}</p>
              <p className="text-xs text-muted-foreground">{new Date(audit.created_at).toLocaleString()}</p>
              <Button variant="outline" className="mt-5 h-9 border-border bg-transparent hover:bg-accent" onClick={() => toast.info("Use Proposal Generator to download a branded PDF.")}>
                <Download className="h-4 w-4 mr-2" /> Download report
              </Button>
            </div>
            <div className="lg:col-span-3 grid grid-cols-2 gap-4">
              {CATEGORIES.map((c) => {
                const sub = (audit.category_scores as any)[c.key] ?? 0;
                const vios = (audit.violations as Violation[]).filter((v) => v.id.toLowerCase().includes(c.key) || true).length; // count below
                const catVios = (audit.violations as Violation[]).filter((v) => v.wcag_criterion?.[5] === ({ perceivable: "1", operable: "2", understandable: "3", robust: "4" } as any)[c.key]).length;
                const status = sub >= 20 ? "Pass" : sub >= 13 ? "Warning" : "Fail";
                const statusCls = status === "Pass" ? "bg-success/15 text-success border-success/30" : status === "Warning" ? "bg-warning/15 text-warning border-warning/30" : "bg-danger/15 text-danger border-danger/30";
                const Icon = c.icon;
                return (
                  <div key={c.key} className="card-elevated p-5">
                    <div className="flex items-start justify-between">
                      <div className="h-9 w-9 rounded-md bg-accent grid place-items-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border", statusCls)}>{status}</span>
                    </div>
                    <h3 className="mt-4 font-medium">{c.label}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-2xl">{sub}</span>
                      <span className="text-xs text-muted-foreground">/ 25</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{catVios} violations</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">Violations found</h2>
              <span className="text-sm text-muted-foreground">{(audit.violations as Violation[]).length} total</span>
            </div>
            <div className="mt-4 space-y-2">
              {(audit.violations as Violation[]).map((v) => {
                const open = expanded.has(v.id);
                return (
                  <div key={v.id} className="card-elevated">
                    <div className="p-4 flex items-start gap-4">
                      <button onClick={() => toggleExp(v.id)} className="flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border", severityPill(v.severity))}>{v.severity}</span>
                          <span className="font-medium text-sm">{v.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{v.wcag_criterion}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-muted-foreground">{v.description}</p>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground hidden sm:inline">Add</span>
                          <Switch checked={selected.has(v.id)} onCheckedChange={() => toggleSel(v.id)} />
                        </div>
                        <button onClick={() => toggleExp(v.id)} className="h-7 w-7 grid place-items-center rounded-md hover:bg-accent">
                          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="px-4 pb-5 pt-1 border-t border-border bg-surface/40 grid gap-4 md:grid-cols-3 text-sm">
                        <div>
                          <p className="label-eyebrow mb-1.5">Element affected</p>
                          <p className="font-mono text-xs">{v.element_affected}</p>
                        </div>
                        <div>
                          <p className="label-eyebrow mb-1.5">Why it matters</p>
                          <p className="text-muted-foreground">{v.legal_impact}</p>
                        </div>
                        <div>
                          <p className="label-eyebrow mb-1.5">How to fix</p>
                          <p className="text-muted-foreground">{v.fix_instructions}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {audit && (
        <div className="sticky bottom-4 z-20">
          <div className="card-elevated p-3 px-5 flex items-center justify-between glow-primary">
            <p className="text-sm">
              <span className="font-mono text-primary">{selected.size}</span>
              <span className="text-muted-foreground"> of {(audit.violations as Violation[]).length} selected for proposal</span>
            </p>
            <Button disabled={selected.size === 0} onClick={goProposal} className="bg-primary hover:bg-primary-hover text-primary-foreground">
              <FileText className="h-4 w-4 mr-2" /> Generate Proposal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
