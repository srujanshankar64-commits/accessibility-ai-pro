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
import { ArrowRight, Loader2, ShieldCheck, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

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

function NewAuditPage() {
  const navigate = useNavigate();
  const auditFn = useServerFn(runAudit);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<RecentRow[]>([]);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("audits")
      .select("id, url, overall_score, violations, created_at, has_proposal")
      .order("created_at", { ascending: false })
      .limit(8);
    if (data) setRows(data as any);
  };

  useEffect(() => { loadRecent(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      const result = await auditFn({ data: { url } });
      setAudit(result);
      const preset = new Set<string>(
        ((result.violations as unknown) as Violation[])
          .filter((v: any) => v.severity === "critical" || v.severity === "serious")
          .map((v: any) => v.id)
      );
      setSelected(preset);
      toast.success("Audit complete");
      loadRecent();
    } catch (err: any) {
      toast.error(err.message ?? "Audit failed");
    } finally { setLoading(false); }
  };

  const toggleSel = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const goProposal = (row?: RecentRow) => {
    const a = row ?? audit;
    if (!a) return;
    const violations = row
      ? row.violations
      : ((audit.violations as unknown) as Violation[]).filter((v: any) => selected.has(v.id));
    sessionStorage.setItem("proposal_seed", JSON.stringify({
      auditId: a.id, url: a.url, score: a.overall_score ?? a.overall_score, violations,
    }));
    navigate({ to: "/proposal" });
  };

  return (
    <div className="animate-slide-up space-y-10">
      <header>
        <h1 className="font-display text-2xl">New Audit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste a client's website URL to run a full WCAG 2.1 compliance scan.
        </p>
      </header>

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
      <p className="-mt-6 text-xs text-muted-foreground">
        Audits check 25+ WCAG criteria across all compliance categories.
      </p>

      {/* Results */}
      {audit && (
        <section className="space-y-6 animate-fade-in">
          <ScoreGauge score={audit.overall_score} />

          <div className="card-elevated">
            <div className="px-5 py-4 border-b border-border">
              <p className="label-eyebrow">Identified violations</p>
            </div>
            <div className="p-3 space-y-1">
              {((audit.violations as unknown) as Violation[]).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-md hover:bg-accent/40 transition-colors">
                  <div>
                    <p className="text-sm">{v.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{v.wcag_criterion}</p>
                  </div>
                  <Switch checked={selected.has(v.id)} onCheckedChange={() => toggleSel(v.id)} />
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => goProposal()}
            className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground"
          >
            Generate proposal from {selected.size} violation{selected.size === 1 ? "" : "s"}
            <ArrowRight className="h-4 w-4 ml-2" />
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
                    <th className="text-left px-5 py-3 label-eyebrow font-medium">Website</th>
                    <th className="text-left px-5 py-3 label-eyebrow font-medium">Score</th>
                    <th className="text-left px-5 py-3 label-eyebrow font-medium">Violations</th>
                    <th className="text-left px-5 py-3 label-eyebrow font-medium">Date</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-accent/30">
                      <td className="px-5 py-3 font-mono text-xs max-w-[280px] truncate">{r.url}</td>
                      <td className="px-5 py-3">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded border font-mono", scorePill(r.overall_score))}>
                          {r.overall_score}/100
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{(r.violations as any[]).length}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Link to="/history" className="h-8 inline-flex items-center px-3 rounded-md border border-border text-xs hover:bg-accent transition-colors">View Report</Link>
                          <button
                            onClick={() => goProposal(r)}
                            className="h-8 inline-flex items-center px-3 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-xs"
                          >
                            Generate Proposal
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
