import { ProposalGenerator } from "@/components/ProposalGenerator";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runAudit } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadFinder } from "@/components/LeadFinder";
import { ScoreGauge } from "@/components/ScoreGauge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Violation } from "@/lib/audit-types";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle } from "lucide-react";

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
      const preset = new Set<string>(
        (result.violations as Violation[])
          .filter((v: any) => v.severity === "critical" || v.severity === "serious")
          .map((v: any) => v.id)
      );
      setSelected(preset);
      toast.success("Audit complete: Vulnerability matrix updated.");
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
    <div className="max-w-5xl mx-auto space-y-8 p-6 animate-in fade-in duration-700">
      <LeadFinder onSelectUrl={(u: string) => setUrl(u)} />

      <Card className="border-slate-800 bg-slate-900/50 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-purple-500" /> Digital Infrastructure Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex gap-4">
            <Input 
              type="url" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="Enter target URL (e.g., https://business.com)" 
              className="bg-slate-950 border-slate-700"
              required 
            />
            <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700">
              {loading ? "Analyzing..." : "Execute Audit"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {audit && (
        <section className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <ScoreGauge score={audit.overall_score} />
          
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle className="text-lg text-slate-300 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} /> Identified Liabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(audit.violations as Violation[]).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-4 border border-slate-800 rounded-lg bg-slate-900 hover:border-slate-600 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">{v.name}</span>
                    <span className="text-xs text-slate-500 font-mono">{v.wcag_criterion}</span>
                  </div>
                  <Switch checked={selected.has(v.id)} onCheckedChange={() => toggleSel(v.id)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Button onClick={goProposal} className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-700">
            Generate Strategic Proposal ({selected.size})
          </Button>

          <Separator className="bg-slate-800" />

          {/* Integrated Closing Engine */}
          <ProposalGenerator 
            auditId={audit.id} 
            url={audit.url} 
            violations={(audit.violations as Violation[]).filter((v: any) => selected.has(v.id))} 
            clientName={audit.business_name || "Prospect Business"} 
            clientIndustry={audit.industry || "General Industry"} 
          />
        </section>
      )}
    </div>
  );
}// Force build trigger