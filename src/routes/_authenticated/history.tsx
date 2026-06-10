import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSearch, Search, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

interface Row {
  id: string; url: string; overall_score: number;
  violations: any[]; has_proposal: boolean; created_at: string;
}

function scorePill(n: number) {
  if (n >= 80) return "bg-success/15 text-success border-success/30";
  if (n >= 50) return "bg-warning/15 text-warning border-warning/30";
  return "bg-danger/15 text-danger border-danger/30";
}

function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [range, setRange] = useState<"all" | "7" | "30" | "90">("all");
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

  const cutoff = range === "all" ? 0 : Date.now() - parseInt(range) * 86400000;
  const filtered = rows.filter((r) =>
    r.url.toLowerCase().includes(q.toLowerCase()) &&
    (range === "all" || new Date(r.created_at).getTime() >= cutoff)
  );

  return (
    <div className="space-y-8 animate-slide-up">
      <header>
        <h1 className="font-display text-2xl">Audit History</h1>
        <p className="mt-2 text-sm text-muted-foreground">All audits run by your agency.</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-card">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search by URL..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
          />
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as any)}
          className="h-10 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card-elevated p-16 text-center">
          <div className="h-12 w-12 mx-auto rounded-md bg-accent grid place-items-center">
            <FileSearch className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {rows.length === 0 ? "No audits yet. Paste a URL on the New Audit page to get started." : "No audits match your filters."}
          </p>
          {rows.length === 0 && (
            <Link to="/audit" className="mt-4 inline-block text-sm text-primary hover:text-primary-hover">Run your first audit →</Link>
          )}
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
                  <th className="text-left px-5 py-3 label-eyebrow font-medium">Proposal</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-accent/30">
                    <td className="px-5 py-3 font-mono text-xs max-w-[280px] truncate">{r.url}</td>
                    <td className="px-5 py-3">
                      <span className={cn("text-[11px] px-2 py-0.5 rounded border font-mono", scorePill(r.overall_score))}>
                        {r.overall_score}/100
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{(r.violations as any[]).length}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border", r.has_proposal ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border")}>
                        {r.has_proposal ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover"
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
