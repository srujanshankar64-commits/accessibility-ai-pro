import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateProposal } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { FileSearch, Search, ArrowUpRight, Lock, Loader2, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPlan, TIER } from "@/lib/tier.utils";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [plan, setPlan] = useState("free");
  const navigate = useNavigate();
  const proposalFn = useServerFn(generateProposal);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("id, url, overall_score, violations, has_proposal, created_at")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message); else setRows(data as any);
      setLoading(false);
    })();
    supabase.from("settings").select("plan").maybeSingle().then(({ data }) => {
      if (data && 'plan' in data) setPlan((data as any).plan);
    });
  }, []);

  const currentPlan = getPlan(plan);
  const canBulkProposal = TIER[currentPlan].bulkCsv; // reuse bulkCsv flag = Business tier

  const cutoff = range === "all" ? 0 : Date.now() - parseInt(range) * 86400000;
  const filtered = rows.filter((r) =>
    r.url.toLowerCase().includes(q.toLowerCase()) &&
    (range === "all" || new Date(r.created_at).getTime() >= cutoff)
  );

  const toggleRow = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  };

  const bulkGenerateProposals = async () => {
    if (!canBulkProposal) {
      toast.error("Upgrade to Business ($199/mo) for bulk proposal generation");
      return;
    }
    const targets = filtered.filter((r) => selected.has(r.id));
    if (targets.length === 0) return;

    setBulkBusy(true);
    setBulkProgress(0);

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const { data: settings } = await supabase
      .from("settings")
      .select("agency_name")
      .maybeSingle();
    const agencyName = (settings as any)?.agency_name ?? "Your Agency";

    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      try {
        const out: any = await proposalFn({
          data: {
            auditId: r.id,
            url: r.url,
            agencyName,
            clientName: "",
            clientIndustry: "General Business",
            tone: "professional",
            priceMin: 2500,
            priceMax: 8000,
            violations: r.violations ?? [],
          },
        });

        const domain = new URL(r.url).hostname.replace("www.", "");
        const txt = [
          `ACCESSIBILITY COMPLIANCE PROPOSAL`,
          `Website: ${r.url}`,
          `Score: ${r.overall_score}/100`,
          `Generated: ${new Date().toLocaleDateString()}`,
          ``,
          `EXECUTIVE SUMMARY`,
          out.executive_summary ?? "",
          ``,
          `COMPLIANCE RISK`,
          out.compliance_risk ?? "",
          ``,
          `VIOLATIONS FOUND`,
          (r.violations ?? []).map((v: any, i: number) =>
            `${i + 1}. [${v.severity?.toUpperCase()}] ${v.name} (${v.wcag_criterion})`
          ).join("\n"),
          ``,
          `REMEDIATION PLAN`,
          out.remediation_plan ?? "",
          ``,
          `INVESTMENT`,
          out.investment ?? "",
          ``,
          `ROI`,
          out.roi_statement ?? "",
          ``,
          `NEXT STEPS`,
          out.next_steps ?? "",
          ``,
          `FOLLOW-UP EMAIL`,
          out.follow_up_email ?? "",
        ].join("\n");

        zip.file(`proposal_${domain}.txt`, txt);

        await (supabase.from("audits") as any).update({ has_proposal: true }).eq("id", r.id);
      } catch {
        // skip failed ones silently
      }
      setBulkProgress(i + 1);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bulk_proposals_${new Date().toISOString().split("T")[0]}.zip`;
    a.click();

    setBulkBusy(false);
    setSelected(new Set());
    toast.success(`${targets.length} proposals generated and downloaded`);

    // refresh has_proposal flags
    const { data } = await supabase
      .from("audits")
      .select("id, url, overall_score, violations, has_proposal, created_at")
      .order("created_at", { ascending: false });
    if (data) setRows(data as any);
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl">Audit History</h1>
          <p className="mt-2 text-sm text-muted-foreground">All audits run by your agency.</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            {canBulkProposal ? (
              <button
                onClick={bulkGenerateProposals}
                disabled={bulkBusy}
                className="h-9 inline-flex items-center gap-2 px-4 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold disabled:opacity-60 transition-colors"
              >
                {bulkBusy
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {bulkProgress}/{selected.size}</>
                  : <><FileDown className="h-3.5 w-3.5" /> Generate {selected.size} Proposal{selected.size > 1 ? "s" : ""}</>
                }
              </button>
            ) : (
              <Link
                to="/settings"
                className="h-9 inline-flex items-center gap-2 px-4 rounded-md border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" /> Bulk Proposals (Business)
              </Link>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="h-9 px-3 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              Clear
            </button>
          </div>
        )}
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

      {bulkBusy && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Generating proposals...</span>
            <span>{bulkProgress} / {selected.size}</span>
          </div>
          <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(bulkProgress / selected.size) * 100}%` }}
            />
          </div>
        </div>
      )}

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
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="rounded border-border accent-primary"
                    />
                  </th>
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
                  <tr key={r.id} className={cn("border-b border-border last:border-b-0 hover:bg-accent/30", selected.has(r.id) && "bg-primary/5")}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                        className="rounded border-border accent-primary"
                      />
                    </td>
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
