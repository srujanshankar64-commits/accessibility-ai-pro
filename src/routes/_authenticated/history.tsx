import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileSearch, Plus, Search, ArrowUpRight, AlertTriangle, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

interface Row {
  id: string; url: string; overall_score: number;
  violations: any[]; has_proposal: boolean; created_at: string;
}

function scoreColor(n: number) {
  if (n >= 80) return "text-success";
  if (n >= 50) return "text-warning";
  return "text-danger";
}

function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("id, url, overall_score, violations, has_proposal, created_at")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message); else setRows(data as any);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => r.url.toLowerCase().includes(q.toLowerCase()));
  const totalAudits = rows.length;
  const avg = totalAudits ? Math.round(rows.reduce((s, r) => s + r.overall_score, 0) / totalAudits) : 0;
  const proposals = rows.filter((r) => r.has_proposal).length;
  const critical = rows.reduce((s, r) => s + (r.violations as any[]).filter((v) => v.severity === "critical").length, 0);

  const stats = [
    { label: "Total audits run", value: totalAudits, icon: FileSearch },
    { label: "Average score", value: avg, icon: BarChart3 },
    { label: "Proposals generated", value: proposals, icon: FileText },
    { label: "Critical violations", value: critical, icon: AlertTriangle, danger: true },
  ];

  return (
    <div className="space-y-8 animate-slide-up">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Audit history</h1>
          <p className="mt-2 text-muted-foreground">All audits run by your agency.</p>
        </div>
        <Link to="/">
          <Button className="bg-primary hover:bg-primary-hover text-primary-foreground"><Plus className="h-4 w-4 mr-2" />New audit</Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card-elevated p-5">
              <div className="flex items-center justify-between">
                <p className="label-eyebrow">{s.label}</p>
                <Icon className={cn("h-4 w-4", s.danger ? "text-danger" : "text-muted-foreground")} />
              </div>
              <p className="mt-3 font-mono text-3xl">{s.value}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="card-elevated p-16 text-center">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-accent grid place-items-center">
            <FileSearch className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-5 font-display text-xl">No audits yet</h2>
          <p className="mt-2 text-muted-foreground">Paste your first client URL to get started.</p>
          <Link to="/"><Button className="mt-6 bg-primary hover:bg-primary-hover text-primary-foreground">Run your first audit</Button></Link>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search URL..." value={q} onChange={(e) => setQ(e.target.value)} className="border-0 bg-transparent focus-visible:ring-0 h-8 px-0 font-mono text-sm" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/50">
                <tr className="text-left">
                  <th className="px-5 py-3 label-eyebrow font-medium">Website</th>
                  <th className="px-5 py-3 label-eyebrow font-medium">Date</th>
                  <th className="px-5 py-3 label-eyebrow font-medium">Score</th>
                  <th className="px-5 py-3 label-eyebrow font-medium">Violations</th>
                  <th className="px-5 py-3 label-eyebrow font-medium">Proposal</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-5 py-3 font-mono text-xs max-w-[280px] truncate">{r.url}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className={cn("px-5 py-3 font-mono", scoreColor(r.overall_score))}>{r.overall_score}</td>
                    <td className="px-5 py-3 text-muted-foreground">{(r.violations as any[]).length}</td>
                    <td className="px-5 py-3">
                      <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border", r.has_proposal ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border")}>
                        {r.has_proposal ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="text-xs text-primary hover:text-primary-hover inline-flex items-center gap-1"
                        onClick={() => {
                          sessionStorage.setItem("proposal_seed", JSON.stringify({
                            auditId: r.id, url: r.url, score: r.overall_score, violations: r.violations,
                          }));
                          navigate({ to: "/proposal" });
                        }}
                      >
                        Open <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
