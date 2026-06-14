import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateProposal, generateColdEmail, generateCertificate, getPlanStatus, generateWebsitePitch } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Download, Mail, ShieldCheck, Lock, Award, AlertTriangle, CheckCircle2, Building2, Globe, TrendingUp, Users, Copy } from "lucide-react";
import type { Violation, ProposalContent } from "@/lib/audit-types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPlan, TIER } from "@/lib/tier.utils";

export const Route = createFileRoute("/_authenticated/proposal")({
  component: ProposalPage,
  errorComponent: () => (
    <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-200 mt-10 max-w-2xl mx-auto">
      <AlertTriangle className="h-10 w-10 mx-auto mb-4 text-red-400" />
      <h2 className="text-lg font-bold">Proposal could not be generated</h2>
      <p className="text-sm mt-2 opacity-80">We encountered an unexpected error while loading the proposal data. Please go back and try running the audit again.</p>
      <Button onClick={() => window.history.back()} variant="outline" className="mt-4 border-red-200 hover:bg-red-100 text-red-700">Go Back</Button>
    </div>
  )
});

interface Seed { auditId?: string; url?: string; score?: number; violations?: Violation[] }

function UpgradeBanner({ message, target }: { message: string; target: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm animate-fade-in">
      <Lock className="h-4 w-4 text-amber-400 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-amber-300 font-medium">{message}</p>
      </div>
      <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shrink-0 transition-colors">
        Upgrade
      </Button>
    </div>
  );
}

function sanitizeContent(out: any): any {
  const safe: any = {};
  for (const key of Object.keys(out)) {
    const val = out[key];
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      safe[key] = Object.values(val).join("\n\n");
    } else if (Array.isArray(val)) {
      safe[key] = val.join("\n");
    } else {
      safe[key] = val ?? "";
    }
  }
  return safe;
}

function ProposalPage() {
  const navigate = useNavigate();
  const proposalFn = useServerFn(generateProposal);
  const emailFn = useServerFn(generateColdEmail);
  const certificateFn = useServerFn(generateCertificate);
  const planStatusFn = useServerFn(getPlanStatus);

  const [seed, setSeed] = useState<Seed>({});
  const [agency, setAgency] = useState("Your Agency");
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#6C63FF");
  const [client, setClient] = useState("");
  const [industry, setIndustry] = useState("E-commerce");
  const [tone, setTone] = useState<"professional" | "urgent" | "consultative">("professional");
  const [priceMin, setPriceMin] = useState(2500);
  const [priceMax, setPriceMax] = useState(8000);
  const [plan, setPlan] = useState("free");
  const [content, setContent] = useState<ProposalContent>({
    executive_summary: "",
    seo_analysis: "",
    compliance_risk: "",
    violation_summary: "",
    remediation_plan: "",
    investment: "",
    roi_statement: "",
    next_steps: "",
    follow_up_email: "",
  });
  const [busy, setBusy] = useState(false);
  const [noWebsiteMode, setNoWebsiteMode] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizIndustry, setBizIndustry] = useState("");
  const [bizCity, setBizCity] = useState("");
  const [bizCustomerType, setBizCustomerType] = useState("B2C");
  const [bizMarketing, setBizMarketing] = useState("Word of mouth only");
  const [bizEmployees, setBizEmployees] = useState("1-5");
  const [pitchBusy, setPitchBusy] = useState(false);
  const [pitchContent, setPitchContent] = useState<any>(null);
  const pitchFn = useServerFn(generateWebsitePitch);

  const generatePitchProposal = async () => {
    if (!bizName || !bizIndustry) { toast.error("Enter business name and industry"); return; }
    setPitchBusy(true);
    try {
      const out = await pitchFn({ data: {
        businessName: bizName,
        industry: bizIndustry,
        city: bizCity,
        customerType: bizCustomerType,
        currentMarketing: bizMarketing,
        employees: bizEmployees,
        agencyName: agency,
        priceMin,
        priceMax,
      }});
      setPitchContent(out);
      toast.success("Website pitch proposal generated!");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate pitch");
    } finally { setPitchBusy(false); }
  };

  const exportPitchPDF = async () => {
    if (!pitchContent) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 60;
    const [r, g, b] = hexToRgb(brandColor);

    doc.setFillColor(r, g, b);
    doc.rect(0, 0, W, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 30);
    doc.text(agency, 48, y); y += 28;

    doc.setFontSize(22);
    doc.text("Digital Presence Proposal", 48, y); y += 28;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 115);
    doc.text(`Prepared exclusively for: ${bizName}`, 48, y); y += 16;
    doc.text(`Industry: ${bizIndustry}`, 48, y); y += 16;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 48, y); y += 28;

    const sections: [string, string][] = [
      ["Executive Summary", pitchContent.executive_summary ?? ""],
      ["Market Analysis", pitchContent.market_analysis ?? ""],
      ["Competitor Insight", pitchContent.competitor_insight ?? ""],
      ["Proposed Solution", pitchContent.proposed_solution ?? ""],
      ["Investment", pitchContent.investment ?? ""],
      ["Return on Investment", pitchContent.roi_statement ?? ""],
      ["Next Steps", pitchContent.next_steps ?? ""],
      ["Outreach Email", pitchContent.pitch_email ?? ""],
    ];

    sections.forEach(([heading, body]) => {
      if (y > 700) { doc.addPage(); y = 60; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(r, g, b);
      doc.text(heading, 48, y); y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(50, 50, 65);
      const lines = doc.splitTextToSize(body, W - 96);
      for (const line of lines) {
        if (y > 750) { doc.addPage(); y = 60; }
        doc.text(line, 48, y); y += 15;
      }
      y += 20;
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 160);
      doc.text(`${agency} — Confidential`, 48, doc.internal.pageSize.getHeight() - 20);
      doc.text(`Page ${i} of ${pageCount}`, W - 48, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    }

    doc.save(`Website_Pitch_${bizName.replace(/\s+/g, "_")}.pdf`);
    toast.success("Pitch PDF exported!");
  };
  const [autoLoading, setAutoLoading] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);
  const hasAutoRun = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("proposal_seed");
    let parsedSeed: Seed = {};
    if (raw) {
      try { parsedSeed = JSON.parse(raw); setSeed(parsedSeed); } catch {}
    }

    supabase.from("settings").select("agency_name, agency_logo_url, brand_color, plan").maybeSingle().then(({ data }) => {
      if (data && 'agency_name' in data) setAgency((data as any).agency_name);
      if (data && 'agency_logo_url' in data) setAgencyLogo((data as any).agency_logo_url);
      if (data && 'brand_color' in data) setBrandColor((data as any).brand_color);
      if (data && 'plan' in data) setPlan((data as any).plan ?? "free");

      const currentPlan = getPlan((data as any)?.plan, 'srujanshankar64@gmail.com');
      if (
        !hasAutoRun.current &&
        parsedSeed.violations?.length &&
        parsedSeed.auditId &&
        TIER[currentPlan].proposals
      ) {
        hasAutoRun.current = true;
        autoGenerate(parsedSeed, (data as any)?.agency_name ?? "Your Agency");
      }
    });
  }, []);

  const autoGenerate = async (s: Seed, agencyName: string) => {
    setAutoLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const out = await proposalFn({ data: {
        auditId: s.auditId, url: s.url, agencyName,
        clientName: "", clientIndustry: "General Business",
        tone: "professional", priceMin: 2500, priceMax: 8000,
        violations: s.violations ?? [],
      }});
      setContent(sanitizeContent(out) as ProposalContent);
      if (s.auditId) {
        await (supabase.from("audits") as any).update({ has_proposal: true }).eq("id", s.auditId);
        await (supabase.from("proposals") as any).insert({
          audit_id: s.auditId, client_name: "", client_industry: "General Business",
          tone: "professional", price_min: 2500, price_max: 8000,
          content: out as any, selected_violations: (s.violations ?? []) as any,
          user_id: user.id,
        });
      }
    } catch (err: any) {
      // silent fail on auto-generate
    } finally { setAutoLoading(false); }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Authentication session expired. Please log in again.");
        return;
      }

      const out = await proposalFn({ data: {
        auditId: seed.auditId, url: seed.url, agencyName: agency, clientName: client,
        clientIndustry: industry, tone, priceMin, priceMax,
        violations: seed.violations ?? [],
      }});
      setContent(sanitizeContent(out) as ProposalContent);
      if (seed.auditId) {
        await (supabase.from("audits") as any).update({ has_proposal: true }).eq("id", seed.auditId);
        await (supabase.from("proposals") as any).insert({
          audit_id: seed.auditId, client_name: client, client_industry: industry,
          tone, price_min: priceMin, price_max: priceMax,
          content: out as any, selected_violations: (seed.violations ?? []) as any,
          user_id: user.id,
        });
      }
      toast.success("Proposal generated successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Generation failed");
    } finally { setBusy(false); }
  };

  const exportPDF = async () => {
    const currentPlan = getPlan(plan, 'srujanshankar64@gmail.com');
    const isWhiteLabel = TIER[currentPlan].whiteLabelPdf;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 60;

    const [r, g, b] = isWhiteLabel ? hexToRgb(brandColor) : [108, 99, 255];
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, W, 8, "F");

    if (currentPlan === "free") {
      doc.setTextColor(240, 240, 245);
      doc.setFontSize(54);
      doc.setFont("helvetica", "bold");
      doc.text("ACCESSAUDIT AI", W / 2, 420, { angle: 45, align: "center" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(isWhiteLabel ? 16 : 14);
    doc.setTextColor(20, 20, 30);
    doc.text(isWhiteLabel ? agency : "Prepared by AccessAudit AI", 48, y); y += 24;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 30);
    doc.text("Website Accessibility Compliance Report", 48, y); y += 32;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 115);
    doc.text(`Prepared for: ${client || "Your Client"}`, 48, y); y += 16;
    doc.text(`Site audited: ${seed.url ?? "—"}`, 48, y); y += 16;
    doc.text(`Compliance score: ${seed.score ?? 0}/100`, 48, y); y += 28;

    // Score badge
    const scoreVal = seed.score ?? 0;
    const badgeColor: [number, number, number] = scoreVal >= 80 ? [34, 197, 94] : scoreVal >= 50 ? [234, 179, 8] : [239, 68, 68];
    doc.setFillColor(...badgeColor);
    doc.roundedRect(48, y, 90, 28, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${scoreVal}/100`, 48 + 45, y + 19, { align: "center" });

    // Severity summary chips
    const violations = seed.violations ?? [];
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    violations.forEach((v) => { if (v.severity && counts[v.severity] !== undefined) counts[v.severity]++; });
    const chipColors: Record<string, [number, number, number]> = {
      critical: [239, 68, 68], serious: [234, 179, 8], moderate: [59, 130, 246], minor: [148, 163, 184],
    };
    let chipX = 48 + 90 + 16;
    (["critical", "serious", "moderate", "minor"] as const).forEach((sev) => {
      const c = counts[sev];
      if (c === 0) return;
      const label = `${c} ${sev}`;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const tw = doc.getTextWidth(label) + 16;
      doc.setFillColor(...chipColors[sev]);
      doc.roundedRect(chipX, y, tw, 28, 14, 14, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(label, chipX + tw / 2, y + 19, { align: "center" });
      chipX += tw + 8;
    });

    doc.setTextColor(50, 50, 65);
    y += 50;

    const sections: [string, string][] = [
      ["Executive Summary", content.executive_summary],
      ["SEO & Accessibility Analysis", content.seo_analysis],
      ["Compliance Risk", content.compliance_risk],
      ["Violations Found", (seed.violations ?? []).map((v, i) =>
        `${i + 1}. [${v.severity?.toUpperCase()}] ${v.name} (${v.wcag_criterion})\n   ${v.description}`
      ).join("\n\n")],
      ["Remediation Plan", content.remediation_plan],
      ["Investment", content.investment || `Project scope fees range: $${priceMin.toLocaleString()} – $${priceMax.toLocaleString()}`],
      ["Return on Investment", content.roi_statement],
      ["Next Steps", content.next_steps],
      ["3-Day Follow-Up Email Template", typeof content.follow_up_email === "object" ? `Subject: ${(content.follow_up_email as any)?.subject || ""}

${(content.follow_up_email as any)?.body || ""}` : (content.follow_up_email || "")],
    ];

    sections.forEach(([heading, body]) => {
      if (y > 700) { doc.addPage(); y = 60; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(r, g, b);
      doc.text(heading, 48, y); y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(50, 50, 65);
      const lines = doc.splitTextToSize(body || "No distinct layout text documented for this field.", W - 96);
      for (const line of lines) {
        if (y > 750) { doc.addPage(); y = 60; }
        doc.text(line, 48, y); y += 15;
      }
      y += 20;
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 160);
      doc.text(
        isWhiteLabel ? `${agency} — Confidential` : "Generated by AccessAudit AI — accessaudit.ai",
        48, doc.internal.pageSize.getHeight() - 20
      );
      doc.text(`Page ${i} of ${pageCount}`, W - 48, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    }

    doc.save(`Accessibility_Report_${client || "Client"}.pdf`);
    toast.success("PDF exported successfully");
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
      toast.error(err.message ?? "Failed to compile email layout");
    } finally { setBusy(false); }
  };

  const handleGenerateCertificate = async () => {
    if (!seed.auditId) { toast.error("Please run an active website audit first"); return; }
    setBusy(true);
    try {
      const cert = await certificateFn({ data: {
        auditId: seed.auditId, url: seed.url ?? "", score: seed.score ?? 0,
        agencyName: agency, clientName: client,
      }});
      setCertificate(cert);
      toast.success("Compliance certificate generated smoothly");
    } catch (err: any) {
      toast.error(err.message ?? "Certificate production failed");
    } finally { setBusy(false); }
  };

  const currentPlan = getPlan(plan, 'srujanshankar64@gmail.com');
  const canPropose = TIER[currentPlan].proposals;
  const canWhiteLabel = TIER[currentPlan].whiteLabelPdf;
  const canColdEmail = TIER[currentPlan].coldEmail;
  const canCertificate = TIER[currentPlan].certificate;
  const isLoading = busy || autoLoading;
  const hasContent = content.executive_summary && typeof content.executive_summary === "string" && content.executive_summary.length > 10;

  const currentAccentColor = canWhiteLabel ? brandColor : "#6C63FF";

  return (
    <div className="animate-slide-up space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Proposal Generator</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {seed.url ? (
              <span>Active Target: <span className="text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded text-xs">{seed.url}</span> — Core Score: <span className="font-semibold text-foreground">{seed.score}/100</span></span>
            ) : "Transform baseline automated audit indicators into highly conversion-optimized client architecture proposals."}
          </p>
        </div>
        {seed.violations && seed.violations.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full self-start sm:self-auto">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{seed.violations.length} Technical Violations Staged</span>
          </div>
        )}
      </header>

      {!canPropose && (
        <UpgradeBanner
          message="Proposal pipeline orchestration is available on our Starter tier configurations ($49/mo) and up."
          target="starter"
        />
      )}

      {/* No Website Mode Toggle */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-card/60">
        <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
          <div
            onClick={() => { setNoWebsiteMode(n => !n); setPitchContent(null); }}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${noWebsiteMode ? "bg-primary" : "bg-accent border border-border"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${noWebsiteMode ? "left-5" : "left-0.5"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Prospect has NO website
            </p>
            <p className="text-xs text-muted-foreground">Switch to website creation pitch mode</p>
          </div>
        </label>
      </div>

      {/* NO WEBSITE MODE — Elite Pitch Generator */}
      {noWebsiteMode && (
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 items-start animate-fade-in">
          {/* Pitch Preview */}
          <div className="card-elevated p-6 sm:p-8 bg-white text-zinc-900 max-h-[85vh] overflow-y-auto relative shadow-2xl rounded-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg grid place-items-center shadow-sm" style={{ backgroundColor: brandColor }}>
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold tracking-tight text-zinc-800 text-sm">{agency}</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded border border-zinc-100">Digital Presence Proposal</span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">Website Creation Proposal</h2>
            <p className="text-sm text-zinc-500 mt-1.5 font-medium">Prepared exclusively for: <span className="text-zinc-800 font-semibold">{bizName || "Business Name"}</span></p>
            <p className="text-xs text-zinc-400 mt-1">{bizIndustry || "Industry"} · {new Date().toLocaleDateString()}</p>

            {!pitchContent && !pitchBusy && (
              <div className="mt-12 text-center py-16 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                <Globe className="h-8 w-8 mx-auto mb-3 text-zinc-400 opacity-60" />
                <p className="text-sm font-medium text-zinc-600">No pitch generated yet</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">Enter business name and industry, then click Generate Pitch Proposal.</p>
              </div>
            )}

            {pitchBusy && (
              <div className="mt-12 text-center py-16 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                <Loader2 className="h-7 w-7 mx-auto mb-3 animate-spin text-zinc-400" />
                <p className="text-sm font-medium text-zinc-600">Generating elite pitch proposal...</p>
                <p className="text-xs text-zinc-400 mt-1">Analyzing market opportunity and competitor landscape.</p>
              </div>
            )}

            {pitchContent && !pitchBusy && (
              <div className="space-y-6 mt-6 animate-fade-in">
                {[
                  ["Executive Summary", pitchContent.executive_summary],
                  ["Market Analysis", pitchContent.market_analysis],
                  ["Competitor Insight", pitchContent.competitor_insight],
                  ["Proposed Solution", pitchContent.proposed_solution],
                ].map(([heading, body]: any) => (
                  <section key={heading} className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: brandColor }}>
                      {heading}
                    </h3>
                    <p className="text-sm text-zinc-700 leading-relaxed">{body}</p>
                  </section>
                ))}

                <section className="rounded-xl bg-zinc-50 border border-zinc-200 p-5 space-y-2 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Investment</span>
                  <p className="font-mono font-black text-zinc-900 text-2xl tracking-tight">${priceMin.toLocaleString()} – ${priceMax.toLocaleString()} USD</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{pitchContent.investment}</p>
                  {pitchContent.roi_statement && (
                    <p className="text-xs text-zinc-600 font-medium italic border-t border-zinc-200/60 pt-2.5 mt-2">{pitchContent.roi_statement}</p>
                  )}
                </section>

                {pitchContent.next_steps && (
                  <section className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: brandColor }}>Next Steps</h3>
                    <p className="text-sm text-zinc-700 leading-relaxed">{pitchContent.next_steps}</p>
                  </section>
                )}

                <section className="rounded-xl border-2 p-5 space-y-3 shadow-sm" style={{ borderColor: `${brandColor}25`, backgroundColor: `${brandColor}04` }}>
                  <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: `${brandColor}15` }}>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" style={{ color: brandColor }} />
                      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: brandColor }}>Cold Outreach Email</h3>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(pitchContent.pitch_email); toast.success("Email copied!"); }}
                      className="h-7 px-2.5 rounded border border-zinc-200 text-xs text-zinc-500 hover:bg-zinc-100 flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <pre className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed font-mono">{pitchContent.pitch_email}</pre>
                </section>
              </div>
            )}
          </div>

          {/* Pitch Controls */}
          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="card-elevated p-5 space-y-4 rounded-2xl border border-border/40 shadow-xl bg-card">
              <h3 className="font-display text-base font-bold tracking-tight">Pitch Configuration</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Business Name</label>
                  <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. Joe's Plumbing" className="w-full h-10 px-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Industry / Niche</label>
                  <input value={bizIndustry} onChange={e => setBizIndustry(e.target.value)} placeholder="e.g. Restaurant" className="w-full h-10 px-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">City</label>
                  <input value={bizCity} onChange={e => setBizCity(e.target.value)} placeholder="e.g. Melbourne" className="w-full h-10 px-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Customer Type</label>
                  <select value={bizCustomerType} onChange={e => setBizCustomerType(e.target.value)} className="w-full h-10 px-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>B2C — Local consumers</option>
                    <option>B2B — Other businesses</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Current Marketing</label>
                  <select value={bizMarketing} onChange={e => setBizMarketing(e.target.value)} className="w-full h-10 px-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>Word of mouth only</option>
                    <option>Social media only</option>
                    <option>Print ads</option>
                    <option>None at all</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Team Size</label>
                  <select value={bizEmployees} onChange={e => setBizEmployees(e.target.value)} className="w-full h-10 px-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>1-5</option>
                    <option>6-20</option>
                    <option>20+</option>
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Agency Name</label>
                  <input value={agency} onChange={e => setAgency(e.target.value)} className="w-full h-10 px-3 bg-background/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Min Budget</span>
                    <span className="font-mono text-primary font-bold">${priceMin.toLocaleString()}</span>
                  </div>
                  <Slider value={[priceMin]} min={500} max={20000} step={250} onValueChange={(v) => setPriceMin(v[0])} className="py-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Max Budget</span>
                    <span className="font-mono text-primary font-bold">${priceMax.toLocaleString()}</span>
                  </div>
                  <Slider value={[priceMax]} min={1000} max={50000} step={500} onValueChange={(v) => setPriceMax(v[0])} className="py-2" />
                </div>
              </div>
            </div>

            <div className="card-elevated p-5 space-y-3 rounded-2xl border border-border/40 shadow-xl bg-card">
              <button
                onClick={generatePitchProposal}
                disabled={pitchBusy || !bizName || !bizIndustry}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              >
                {pitchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {pitchContent ? "Regenerate Pitch Proposal" : "Generate Pitch Proposal"}
              </button>
              <button
                onClick={exportPitchPDF}
                disabled={!pitchContent}
                className="w-full h-11 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              >
                <Download className="h-4 w-4" />
                Export White-Label Pitch PDF
              </button>
              <button
                onClick={() => { if (pitchContent?.pitch_email) { navigator.clipboard.writeText(pitchContent.pitch_email); toast.success("Email copied!"); } }}
                disabled={!pitchContent}
                className="w-full h-11 border border-border hover:bg-accent text-foreground rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-all text-sm"
              >
                <Mail className="h-4 w-4" />
                Copy Cold Outreach Email
              </button>
            </div>
          </div>
        </div>
      )}

      {autoLoading && (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground bg-accent/40 border p-3.5 rounded-xl animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Synchronizing audit structure variables... Compiling intelligence pipeline layout vectors.
        </div>
      )}

      {!noWebsiteMode && (
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
        {/* Preview Panel Canvas */}
        <div className="card-elevated p-6 sm:p-8 bg-white text-zinc-900 max-h-[85vh] overflow-y-auto relative shadow-2xl rounded-2xl border border-zinc-200">
          {currentPlan === "free" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-2xl select-none">
              <span className="text-7xl font-black text-zinc-100/80 tracking-widest uppercase rotate-[-35deg]">
                UNLICENSED PREVIEW
              </span>
            </div>
          )}

          {/* Canvas Brand Header Row */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-5 mb-6">
            <div className="flex items-center gap-3">
              {canWhiteLabel && agencyLogo ? (
                <img src={agencyLogo} alt="Agency identifier branding" className="h-7 w-auto object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-lg grid place-items-center shadow-sm" style={{ backgroundColor: currentAccentColor }}>
                  <ShieldCheck className="h-4 w-4 text-white" />
                </div>
              )}
              <span className="font-bold tracking-tight text-zinc-800 text-sm">{canWhiteLabel ? agency : "AccessAudit AI Platform"}</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded border border-zinc-100">Confidential Framework</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">Website Accessibility Compliance Report</h2>
          <p className="text-sm text-zinc-500 mt-1.5 font-medium">Prepared exclusively for: <span className="text-zinc-800 underline decoration-zinc-200 underline-offset-4">{client || "Unspecified Entity"}</span></p>
          <p className="text-xs text-zinc-400 mt-1 font-mono">{seed.url ? `${seed.url} — Core Score Vector: ${seed.score ?? 0}/100` : "No baseline audit metrics contextualized."}</p>

          {!hasContent && !isLoading && (
            <div className="mt-12 text-center py-16 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-zinc-400 opacity-60" />
              <p className="text-sm font-medium text-zinc-600">No layout generated yet</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">Click "Generate Proposal" inside the dashboard controller to execute automated model scanning processes.</p>
            </div>
          )}

          {isLoading && (
            <div className="mt-12 text-center py-16 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
              <Loader2 className="h-7 w-7 mx-auto mb-3 animate-spin text-zinc-400" />
              <p className="text-sm font-medium text-zinc-600">Executing generation pipelines...</p>
              <p className="text-xs text-zinc-400 mt-1">Our generative model arrays are standardizing compliance rules data.</p>
            </div>
          )}

          {hasContent && !isLoading && (
            <div className="space-y-6 mt-6 animate-fade-in">
              {[
                ["Executive Summary", content.executive_summary, "executive_summary"],
                ["SEO & Accessibility Analysis", content.seo_analysis, "seo_analysis"],
                ["Compliance Risk Assessment", content.compliance_risk, "compliance_risk"],
              ].map(([h, body, key]) => (
                <section key={h} className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: currentAccentColor }}>{h}</h3>
                  <Textarea 
                    value={body || ""} 
                    onChange={(e) => setContent((c) => ({ ...c, [key]: e.target.value }))} 
                    className="bg-zinc-50/30 border-zinc-200 text-zinc-800 focus-visible:ring-zinc-400 min-h-[100px] text-sm leading-relaxed rounded-xl shadow-inner resize-y transition-all" 
                  />
                </section>
              ))}

              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: currentAccentColor }}>Identified Technical Violations</h3>
                {seed.violations && seed.violations.length > 0 ? (
                  <ul className="space-y-2.5">
                    {seed.violations.map((v, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/40 hover:bg-zinc-50 transition-colors">
                        <span className={`shrink-0 text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm ${
                          v.severity === "critical" ? "bg-red-50 text-red-700 border border-red-100" :
                          v.severity === "serious" ? "bg-orange-50 text-orange-700 border border-orange-100" :
                          v.severity === "moderate" ? "bg-yellow-50 text-yellow-700 border border-yellow-100" :
                          "bg-zinc-100 text-zinc-600"
                        }`}>{v.severity}</span>
                        <div className="space-y-0.5">
                          <p className="text-sm text-zinc-800 font-semibold leading-none">{v.name}</p>
                          <p className="text-xs text-zinc-400 font-mono tracking-tight">{v.wcag_criterion}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="border border-dashed border-zinc-200 rounded-xl p-6 text-center text-sm text-zinc-400 bg-zinc-50/50 my-2">
                    No specific technical violations selected. Run a new scan or check your history tab to populate this section.
                  </div>
                )}
              </section>

              {[
                ["Technical Remediation Matrix", content.remediation_plan, "remediation_plan"],
              ].map(([h, body, key]) => (
                <section key={h} className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: currentAccentColor }}>{h}</h3>
                  <Textarea 
                    value={body || ""} 
                    onChange={(e) => setContent((c) => ({ ...c, [key]: e.target.value }))} 
                    className="bg-zinc-50/30 border-zinc-200 text-zinc-800 focus-visible:ring-zinc-400 min-h-[100px] text-sm leading-relaxed rounded-xl shadow-inner resize-y transition-all" 
                  />
                </section>
              ))}

              <section className="rounded-xl bg-zinc-50 border border-zinc-200 p-5 space-y-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Budget Allocation Blueprint</span>
                <p className="font-mono font-black text-zinc-900 text-2xl tracking-tight">${priceMin.toLocaleString()} – ${priceMax.toLocaleString()} USD</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{content.investment || "Final functional engineering scope metrics parameters to be confirmed following kickoff call verification processes."}</p>
                {content.roi_statement && (
                  <p className="text-xs text-zinc-600 font-medium italic border-t border-zinc-200/60 pt-2.5 mt-2">{content.roi_statement}</p>
                )}
              </section>

              {content.next_steps && (
                <section className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: currentAccentColor }}>Next Operational Steps</h3>
                  <Textarea value={content.next_steps} onChange={(e) => setContent((c) => ({ ...c, next_steps: e.target.value }))} className="bg-zinc-50/30 border-zinc-200 text-zinc-800 focus-visible:ring-zinc-400 min-h-[90px] text-sm rounded-xl resize-y" />
                </section>
              )}

              <section className="rounded-xl border-2 p-5 space-y-3 shadow-sm transition-all" style={{ borderColor: `${currentAccentColor}25`, backgroundColor: `${currentAccentColor}04` }}>
                <div className="flex items-center gap-2 border-b pb-2.5" style={{ borderColor: `${currentAccentColor}15` }}>
                  <Mail className="h-4 w-4" style={{ color: currentAccentColor }} />
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: currentAccentColor }}>3-Day Automated Follow-Up Sequence</h3>
                </div>
                <Textarea value={typeof content.follow_up_email === "object" ? JSON.stringify(content.follow_up_email) : (content.follow_up_email || "")} onChange={(e) => setContent((c) => ({ ...c, follow_up_email: e.target.value }))} className="bg-white border-zinc-200 text-zinc-800 focus-visible:ring-zinc-300 min-h-[120px] font-mono text-xs leading-relaxed rounded-lg shadow-sm" placeholder="Awaiting proposal compilation parameters..." />
              </section>
            </div>
          )}

          {/* Professional Compliance Cert Module */}
          {certificate && (
            <section className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center border-l-4 border-l-emerald-500 animate-fade-in shadow-sm">
              <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-bold text-emerald-400 text-base tracking-tight">WCAG 2.1 AA Compliance Certification Staged</h3>
              <p className="text-xs text-emerald-500/80 font-mono mt-1">Registry Index Token: #{certificate.certificateNumber}</p>
              <div className="grid grid-cols-2 gap-2 mt-4 max-w-sm mx-auto text-left border-t border-emerald-500/10 pt-3 text-[11px] text-emerald-400/70 font-medium">
                <div>Scope Node: <span className="text-emerald-300 font-mono">{certificate.issuedTo || "Client Profile"}</span></div>
                <div>Calculated Index: <span className="text-emerald-300 font-bold">{certificate.score}/100</span></div>
                <div className="col-span-2 text-center text-[10px] mt-1 font-mono text-emerald-500/50">Range: {certificate.issuedDate} through {certificate.expiryDate}</div>
              </div>
            </section>
          )}
        </div>

        {/* Configurations Engineering Command Interface Panel */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="card-elevated p-5 space-y-4 rounded-2xl border border-border/40 shadow-xl bg-card">
            <h3 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              Configuration Controls
            </h3>

            <div className="space-y-1.5">
              <Label className="label-eyebrow text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Agency Brand Name</Label>
              <Input value={agency} onChange={(e) => setAgency(e.target.value)} className="h-10 bg-background/50 focus-visible:ring-primary/40 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Target Client Identifier</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Acme Dental Clinic" className="h-10 bg-background/50 focus-visible:ring-primary/40 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Industrial Classification</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="h-10 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {["Dental","Healthcare","Legal","E-commerce","SaaS","Education","Finance","Hospitality","Real Estate","Non-profit","Government","Other"].map((x) => (
                    <SelectItem key={x} value={x} className="rounded-lg">{x}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Copywriting Communication Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger className="h-10 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="professional" className="rounded-lg">Professional</SelectItem>
                  <SelectItem value="urgent" className="rounded-lg">Urgent</SelectItem>
                  <SelectItem value="consultative" className="rounded-lg">Consultative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4 pt-2 border-t border-border/40">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <Label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Minimum Scope Budget</Label>
                  <span className="font-mono text-primary font-bold text-sm">${priceMin.toLocaleString()}</span>
                </div>
                <Slider value={[priceMin]} min={500} max={20000} step={250} onValueChange={(v) => setPriceMin(v[0])} className="py-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <Label className="text-[10px] tracking-wider text-muted-foreground uppercase font-bold">Maximum Scope Budget</Label>
                  <span className="font-mono text-primary font-bold text-sm">${priceMax.toLocaleString()}</span>
                </div>
                <Slider value={[priceMax]} min={1000} max={50000} step={500} onValueChange={(v) => setPriceMax(v[0])} className="py-2" />
              </div>
            </div>
          </div>

          {/* Document Compilation Run Controls */}
          <div className="card-elevated p-5 space-y-3 rounded-2xl border border-border/40 shadow-xl bg-card">
            {canPropose ? (
              <Button disabled={isLoading} onClick={regenerate} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl font-medium tracking-tight shadow-lg shadow-primary/10 transition-all active:scale-[0.99]">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {hasContent ? "Regenerate Core Matrix" : "Compile Asset Proposal"}
              </Button>
            ) : (
              <UpgradeBanner message="Unlock automated document compiling pipelines." target="starter" />
            )}

            <Button onClick={exportPDF} disabled={!hasContent} className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground h-11 rounded-xl font-medium tracking-tight transition-all active:scale-[0.99]">
              <Download className="h-4 w-4 mr-2" />
              {canWhiteLabel ? "Export White-Label Asset PDF" : "Export Basic Blueprint PDF"}
            </Button>

            {!canWhiteLabel && (
              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" />
                Unrestricted white-label parameters require Agency subscription matrix ($99/mo).
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/40">
              {canColdEmail ? (
                <Button onClick={copyEmail} disabled={isLoading || !hasContent} variant="outline" className="h-10 border-border bg-background hover:bg-accent rounded-xl text-xs font-medium tracking-tight">
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Copy Pitch Frame
                </Button>
              ) : (
                <Button disabled variant="outline" className="h-10 border-border/40 opacity-40 rounded-xl text-xs font-medium cursor-not-allowed">
                  <Lock className="h-3.5 w-3.5 mr-1.5" /> Email Restricted
                </Button>
              )}

              {canCertificate ? (
                <Button onClick={handleGenerateCertificate} disabled={isLoading} variant="outline" className="h-10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-xl text-xs font-medium tracking-tight">
                  <Award className="h-3.5 w-3.5 mr-1.5" /> Issue Certificate
                </Button>
              ) : (
                <Button disabled variant="outline" className="h-10 border-border/40 opacity-40 rounded-xl text-xs font-medium cursor-not-allowed">
                  <Lock className="h-3.5 w-3.5 mr-1.5" /> Cert Restricted
                </Button>
              )}
            </div>
          </div>

          {/* Core Plan Subscription Matrix Summary */}
          <div className="card-elevated p-4 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Workspace Provision</span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-sm ${
                currentPlan === "business" ? "bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20" :
                currentPlan === "agency" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
                currentPlan === "starter" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20"
              }`}>
                {currentPlan} plan
              </span>
            </div>
            {currentPlan === "free" && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Your current configuration profile tier limits automated data exports, cold email pipelines, and certification tokens.
              </p>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  if (!hex) return [108, 99, 255];
  
  // Strip spaces and leading pound sign
  let cleanHex = hex.replace("#", "").trim();
  
  // Handle shorthand strings like 'fff' or '63f'
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map(char => char + char).join("");
  }
  
  // Rigid evaluation regex verification checks
  const match = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
  
  return match
    ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
    : [108, 99, 255]; // Stable fall-back parameter configuration vector match
}