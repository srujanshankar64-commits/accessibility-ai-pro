import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateProposal, generateColdEmail } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Download, Mail, ShieldCheck } from "lucide-react";
import type { Violation, ProposalContent } from "@/lib/audit-types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/proposal")({
  component: ProposalPage,
});

interface Seed { auditId?: string; url?: string; score?: number; violations?: Violation[] }

function ProposalPage() {
  const proposalFn = useServerFn(generateProposal);
  const emailFn = useServerFn(generateColdEmail);
  const [seed, setSeed] = useState<Seed>({});
  const [agency, setAgency] = useState("Your Agency");
  const [client, setClient] = useState("");
  const [industry, setIndustry] = useState("E-commerce");
  const [tone, setTone] = useState<"professional" | "urgent" | "consultative">("professional");
  const [priceMin, setPriceMin] = useState(3500);
  const [priceMax, setPriceMax] = useState(9500);
  const [content, setContent] = useState<ProposalContent>({
    executive_summary: "Click 'Generate with AI' to draft this proposal based on the selected audit findings.",
    legal_risk: "",
    solution: "",
    next_steps: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("proposal_seed");
    if (raw) try { setSeed(JSON.parse(raw)); } catch {}
    supabase.from("settings").select("agency_name").maybeSingle().then(({ data }) => {
      if (data?.agency_name) setAgency(data.agency_name);
    });
  }, []);

  const regenerate = async () => {
    setBusy(true);
    try {
      const out = await proposalFn({ data: {
        auditId: seed.auditId, url: seed.url, agencyName: agency, clientName: client,
        clientIndustry: industry, tone, priceMin, priceMax,
        violations: seed.violations ?? [],
      }});
      setContent(out as ProposalContent);
      // mark audit as proposal-generated
      if (seed.auditId) {
        await supabase.from("audits").update({ has_proposal: true }).eq("id", seed.auditId);
        await supabase.from("proposals").insert({
          audit_id: seed.auditId, client_name: client, client_industry: industry,
          tone, price_min: priceMin, price_max: priceMax,
          content: out as any, selected_violations: (seed.violations ?? []) as any,
          user_id: (await supabase.auth.getUser()).data.user?.id!,
        });
      }
      toast.success("Proposal generated");
    } catch (err: any) {
      toast.error(err.message ?? "Generation failed");
    } finally { setBusy(false); }
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 60;
    doc.setFillColor(108, 99, 255);
    doc.rect(0, 0, W, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(20, 20, 30);
    doc.text("Website Accessibility Compliance Report", 48, y); y += 30;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(110, 110, 130);
    doc.text(`Prepared by ${agency} for ${client || "your business"}`, 48, y); y += 14;
    doc.text(`Site audited: ${seed.url ?? "—"}    Compliance score: ${seed.score ?? 0}/100`, 48, y); y += 32;

    const sections: [string, string][] = [
      ["Executive Summary", content.executive_summary],
      ["Legal Risk", content.legal_risk],
      ["Violations Found", (seed.violations ?? []).map((v, i) => `${i + 1}. [${v.severity.toUpperCase()}] ${v.name} (${v.wcag_criterion}) — ${v.description}`).join("\n")],
      ["Our Solution", content.solution],
      ["Investment", `Project range: $${priceMin.toLocaleString()} – $${priceMax.toLocaleString()} (scope dependent).`],
      ["Next Steps", content.next_steps],
    ];
    sections.forEach(([heading, body]) => {
      if (y > 720) { doc.addPage(); y = 60; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 20, 30);
      doc.text(heading, 48, y); y += 18;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(60, 60, 80);
      const lines = doc.splitTextToSize(body || "—", W - 96);
      for (const line of lines) {
        if (y > 770) { doc.addPage(); y = 60; }
        doc.text(line, 48, y); y += 14;
      }
      y += 14;
    });
    doc.save(`accessibility-proposal-${(client || "client").replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const copyEmail = async () => {
    setBusy(true);
    try {
      const out: any = await emailFn({ data: {
        agencyName: agency, clientName: client, url: seed.url ?? "",
        violations: seed.violations ?? [], score: seed.score ?? 0,
      }});
      await navigator.clipboard.writeText(`Subject: ${out.subject}\n\n${out.body}`);
      toast.success("Cold email copied to clipboard");
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="animate-slide-up">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Proposal generator</h1>
        <p className="mt-2 text-muted-foreground">Turn audit findings into a client-ready proposal.</p>
      </header>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Preview */}
        <div className="card-elevated p-8 bg-white text-zinc-900 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-[#6C63FF] grid place-items-center">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold tracking-tight">{agency}</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Confidential</span>
          </div>
          <h2 className="text-2xl font-bold leading-tight">Website Accessibility Compliance Report</h2>
          <p className="text-sm text-zinc-500 mt-1">Prepared for <span className="font-medium text-zinc-800">{client || "Client name"}</span></p>
          <p className="text-xs text-zinc-500 mt-1 font-mono">{seed.url} — Score: {seed.score ?? 0}/100</p>

          {[
            ["Executive Summary", content.executive_summary, "executive_summary"],
            ["Legal Risk", content.legal_risk, "legal_risk"],
          ].map(([h, body, key]) => (
            <section key={h} className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6C63FF]">{h}</h3>
              <Textarea
                value={body as string}
                onChange={(e) => setContent((c) => ({ ...c, [key as string]: e.target.value }))}
                className="mt-2 bg-transparent border-zinc-200 text-zinc-800 focus-visible:ring-zinc-300 min-h-[80px]"
              />
            </section>
          ))}

          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6C63FF]">Violations Found</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(seed.violations ?? []).map((v, i) => (
                <li key={i} className="leading-snug">
                  <span className="font-medium">{v.name}</span>{" "}
                  <span className="text-zinc-500 text-xs">({v.wcag_criterion})</span>
                </li>
              ))}
              {(seed.violations ?? []).length === 0 && <li className="text-zinc-500 text-sm">No violations selected. Pick some from the New Audit page.</li>}
            </ul>
          </section>

          {[
            ["Our Solution", content.solution, "solution"],
            ["Next Steps", content.next_steps, "next_steps"],
          ].map(([h, body, key]) => (
            <section key={h} className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6C63FF]">{h}</h3>
              <Textarea
                value={body as string}
                onChange={(e) => setContent((c) => ({ ...c, [key as string]: e.target.value }))}
                className="mt-2 bg-transparent border-zinc-200 text-zinc-800 focus-visible:ring-zinc-300 min-h-[80px]"
              />
            </section>
          ))}

          <section className="mt-6 rounded-lg bg-zinc-50 border border-zinc-200 p-4 text-sm">
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Investment</span>
            <p className="mt-1 font-semibold text-zinc-900">${priceMin.toLocaleString()} – ${priceMax.toLocaleString()}</p>
            <p className="mt-1 text-xs text-zinc-500">Final scope confirmed after kickoff call.</p>
          </section>
        </div>

        {/* Config */}
        <div className="space-y-5">
          <div className="card-elevated p-5 space-y-4">
            <h3 className="font-display">Configuration</h3>
            <div className="space-y-2">
              <Label className="label-eyebrow">Agency name</Label>
              <Input value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="label-eyebrow">Client name</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Co." />
            </div>
            <div className="space-y-2">
              <Label className="label-eyebrow">Client industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["E-commerce","SaaS","Healthcare","Education","Finance","Hospitality","Legal","Non-profit","Government","Other"].map((x) => (
                    <SelectItem key={x} value={x}>{x}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="label-eyebrow">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="consultative">Consultative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="label-eyebrow">Min fee</Label>
                <span className="font-mono text-sm">${priceMin.toLocaleString()}</span>
              </div>
              <Slider value={[priceMin]} min={500} max={20000} step={250} onValueChange={(v) => setPriceMin(v[0])} />
              <div className="flex items-center justify-between">
                <Label className="label-eyebrow">Max fee</Label>
                <span className="font-mono text-sm">${priceMax.toLocaleString()}</span>
              </div>
              <Slider value={[priceMax]} min={1000} max={50000} step={500} onValueChange={(v) => setPriceMax(v[0])} />
            </div>
          </div>

          <div className="card-elevated p-5 space-y-3">
            <Button disabled={busy} onClick={regenerate} className="w-full bg-primary hover:bg-primary-hover text-primary-foreground h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Regenerate with AI
            </Button>
            <Button onClick={exportPDF} className="w-full bg-primary hover:bg-primary-hover text-primary-foreground h-11">
              <Download className="h-4 w-4 mr-2" /> Export as PDF
            </Button>
            <Button onClick={copyEmail} disabled={busy} variant="outline" className="w-full h-11 border-border bg-transparent hover:bg-accent">
              <Mail className="h-4 w-4 mr-2" /> Copy email draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
