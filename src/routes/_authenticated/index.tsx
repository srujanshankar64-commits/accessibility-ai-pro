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
import { LeadFinder } from "@/components/LeadFinder";

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
      const preset = new Set<string>((result.violations as unknown as Violation[]).filter((v) => v.severity === "critical" || v.severity === "serious").map((v) => v.id));
      setSelected(preset);
      toast.success("Audit complete");
    } catch (err: any) {
      toast.error(err.message ?? "Audit failed");
    } finally {
      clearInterval(stages);
      setLoading(false);
    }
  };

  const toggleSel = (id: string) => { setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleExp = (id: string) => { setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const goProposal = () => {
    if (!audit) return;
    const violations = (audit.violations as Violation[]).filter((v) => selected.has(v.id));
    sessionStorage.setItem("proposal_seed", JSON.stringify({ auditId: audit.id, url: audit.url, score: audit.overall_score, violations }));
    navigate({ to: "/proposal" });
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <LeadFinder onSelectUrl={(u) => { setUrl(u); window.scrollTo({ top: 400, behavior: 'smooth' }); }} />

      <header className="pt-8 border-t border-slate-800">
        <h1 className="font-display text-3xl">Audit a website</h1>
      </header>

      <div className="card-elevated p-6">
        <form onSubmit={submit} className="space-y-4">
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourclient.com" required disabled={loading} />
          {loading ? (
             <div className="h-2 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary animate-pulse-soft" style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }} /></div>
          ) : (
            <Button type="submit" className="w-full">Run Audit</Button>
          )}
        </form>
      </div>

      {audit && (
        <section className="space-y-6">
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="card-elevated p-6 lg:col-span-2 flex flex-col items-center">
              <ScoreGauge score={audit.overall_score} />
            </div>
            <div className="lg:col-span-3 grid grid-cols-2 gap-4">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="card-elevated p-5">
                  <h3 className="font-medium">{c.label}</h3>
                  <span className="font-mono text-2xl">{audit.category_scores[c.key as keyof typeof audit.category_scores]}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            {(audit.violations as Violation[]).map((v) => (
              <div key={v.id} className="card-elevated p-4 flex justify-between">
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm text-muted-foreground">{v.description}</p>
                </div>
                <Switch checked={selected.has(v.id)} onCheckedChange={() => toggleSel(v.id)} />
              </div>
            ))}
          </div>

          <Button onClick={goProposal} className="w-full">Generate Proposal ({selected.size} items)</Button>
        </section>
      )}
    </div>
  );
}