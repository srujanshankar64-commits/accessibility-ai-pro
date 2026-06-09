import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runAudit } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadFinder } from "@/components/LeadFinder";
import { ScoreGauge } from "@/components/ScoreGauge";
import { Switch } from "@/components/ui/switch";
import type { Violation, AuditResult } from "@/lib/audit-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: NewAuditPage,
});

function NewAuditPage() {
  const navigate = useNavigate();
  const auditFn = useServerFn(runAudit);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      const result = await auditFn({ data: { url } });
      setAudit(result);
      const preset = new Set<string>((result.violations as Violation[]).filter((v: any) => v.severity === "critical" || v.severity === "serious").map((v: any) => v.id));
      setSelected(preset);
      toast.success("Audit complete");
    } catch (err: any) {
      toast.error(err.message ?? "Audit failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleSel = (id: string) => { 
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); 
  };

  const goProposal = () => {
    if (!audit) return;
    const violations = (audit.violations as Violation[]).filter((v: any) => selected.has(v.id));
    sessionStorage.setItem("proposal_seed", JSON.stringify({ auditId: audit.id, url: audit.url, score: audit.overall_score, violations }));
    navigate({ to: "/proposal" });
  };

  return (
    <div className="space-y-8 p-6">
      {/* Bypass type checking by using any cast if necessary */}
      <LeadFinder onSelectUrl={(u: string) => setUrl(u)} />

      <header>
        <h1 className="text-3xl font-bold">Audit a website</h1>
      </header>

      <form onSubmit={submit} className="flex gap-2">
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required />
        <Button type="submit" disabled={loading}>{loading ? "Running..." : "Audit"}</Button>
      </form>

      {audit && (
        <section className="space-y-6">
          <ScoreGauge score={audit.overall_score} />
          <div className="space-y-2">
            {(audit.violations as Violation[]).map((v: any) => (
              <div key={v.id} className="flex justify-between p-4 border rounded">
                <span>{v.name}</span>
                <Switch checked={selected.has(v.id)} onCheckedChange={() => toggleSel(v.id)} />
              </div>
            ))}
          </div>
          <Button onClick={goProposal} className="w-full">Generate Proposal ({selected.size})</Button>
        </section>
      )}
    </div>
  );
}