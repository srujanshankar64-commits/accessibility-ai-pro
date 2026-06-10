import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, Eye, EyeOff, Lock, Zap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPlan, TIER } from "@/lib/tier.utils";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

// Inline mappings to fix the build errors immediately
const LOCAL_PLAN_LABELS: Record<string, string> = {
  free: "Free Plan",
  starter: "Starter Plan",
  agency: "Agency Hub",
  business: "Business Enterprise",
};

const LOCAL_PLAN_PRICES: Record<string, string> = {
  free: "0",
  starter: "49",
  agency: "99",
  business: "199",
};

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const [agencyName, setAgencyName] = useState("");
  const [brandColor, setBrandColor] = useState("#6E56CF");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [plan, setPlan] = useState<"free" | "starter" | "agency" | "business">("free");
  const [used, setUsed] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("*").maybeSingle().then(({ data }) => {
      if (!data) return;
      setAgencyName(data.agency_name ?? "");
      setBrandColor(data.brand_color ?? "#6E56CF");
      setApiKey(data.gemini_api_key ?? "");
      setPlan((data.plan as any) ?? "free");
      setUsed(data.audits_used ?? 0);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      agency_name: agencyName,
      brand_color: brandColor,
      gemini_api_key: apiKey,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Settings saved successfully");
    }
  };

  const handleUpgradeCheckout = (tierName: string) => {
    toast.success(`Redirecting to Stripe secure checkout for ${tierName.toUpperCase()} plan...`);
  };

  const currentPlan = getPlan(plan);
  const config = TIER[currentPlan];
  const auditLimit = config.audits;
  const isUnlimited = auditLimit >= 999999;
  const progressValue = isUnlimited ? 0 : (used / auditLimit) * 100;

  const hasBrandingAccess = currentPlan === "agency" || currentPlan === "business";

  const inputCls = "w-full h-10 px-3 rounded bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";

  return (
    <div className="space-y-10 animate-slide-up max-w-5xl mx-auto p-4 sm:p-6 text-slate-100">
      <header>
        <h1 className="font-display text-2xl text-white">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your agency branding, active integrations, and subscription billing profiles.</p>
      </header>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
        <div className="space-y-8">
          
          {/* Agency Branding Configuration section */}
          <section className="card-elevated p-6 space-y-5 relative overflow-hidden bg-slate-900/40 border border-slate-800 rounded-xl">
            {!hasBrandingAccess && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1.5px] z-10 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <Lock className="h-5 w-5 text-purple-400 mb-2" />
                <h3 className="text-sm font-bold text-white">White-Label Branding Gated</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">Custom white-label reports, colored PDF grids, and custom logo overrides require the Agency plan tier profile.</p>
                <Button size="sm" onClick={() => handleUpgradeCheckout("agency")} className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs h-9 px-4">
                  Unlock Custom Branding
                </Button>
              </div>
            )}

            <div>
              <p className="label-eyebrow text-sm font-bold tracking-wide">Agency Branding</p>
              <p className="text-xs text-muted-foreground mt-1">Appears on generated client proposals and white-label compliance PDF exports.</p>
            </div>

            <div className="border-2 border-dashed border-slate-800 rounded-md p-6 text-center bg-background/50">
              <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Upload agency corporate logo</p>
              <p className="text-xs text-muted-foreground/70">PNG or SVG · max 2MB</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="label-eyebrow text-xs text-muted-foreground">Agency name</label>
                <input className={inputCls} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} disabled={!hasBrandingAccess} />
              </div>
              <div className="space-y-1.5">
                <label className="label-eyebrow text-xs text-muted-foreground">Brand color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} disabled={!hasBrandingAccess} className="h-10 w-12 rounded border border-border bg-background cursor-pointer disabled:opacity-50" />
                  <input className={cn(inputCls, "font-mono")} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} disabled={!hasBrandingAccess} />
                </div>
              </div>
            </div>
          </section>

          {/* AI Core Gateway Configurations Block */}
          <section className="card-elevated p-6 space-y-4 bg-slate-900/40 border border-slate-800 rounded-xl">
            <div>
              <p className="label-eyebrow text-sm font-bold tracking-wide">AI Engine Token Overrides</p>
              <p className="text-xs text-muted-foreground mt-1">Optional override. Leaving this completely void routes your platform queries straight through the standard AccessAudit AI secure gateway cluster.</p>
            </div>
            <div className="space-y-1.5">
              <label className="label-eyebrow text-xs text-muted-foreground">Gemini API Key Token ID (Google AI Studio Model)</label>
              <div className="relative">
                <input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={cn(inputCls, "font-mono pr-10")} placeholder="AIzaSy..." />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-300 transition-colors">
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary-hover text-primary-foreground min-w-[140px]">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />} 
              Save Changes
            </Button>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Account Profile Block */}
          <section className="space-y-4">
            <div>
              <p className="label-eyebrow text-sm font-bold tracking-wide">Account Profile</p>
            </div>
            <div className="card-elevated p-6 space-y-5 bg-slate-900/40 border border-slate-800 rounded-xl">
              <div className="space-y-1.5">
                <label className="label-eyebrow text-xs text-muted-foreground">Developer Account Email</label>
                <input value={user.email ?? ""} disabled className={cn(inputCls, "font-mono opacity-70")} />
              </div>
              <Button variant="outline" className="border-slate-800 hover:bg-slate-800 text-slate-300">Change password</Button>

              <div className="pt-5 border-t border-slate-800">
                <p className="label-eyebrow text-red-400 font-semibold">Danger zone</p>
                <p className="mt-1 text-xs text-muted-foreground">Permanently delete your account workspace parameters and data streams. This operation is irreversible.</p>
                <Button variant="outline" className="mt-3 border-red-500/30 text-red-400 hover:bg-red-500/10">Delete account</Button>
              </div>
            </div>
          </section>
        </div>

        {/* Pricing Selection Right Container Sidebar Block */}
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <p className="label-eyebrow text-sm font-bold tracking-wide">Active Plan Allocation</p>
            </div>
            
            <div className="card-elevated p-6 space-y-5 bg-slate-900/40 border border-slate-800 rounded-xl">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-primary font-display text-lg uppercase font-bold tracking-wider">
                      {LOCAL_PLAN_LABELS[currentPlan] || currentPlan}
                    </span>
                    <span className="text-muted-foreground text-xs font-mono">
                      · ${LOCAL_PLAN_PRICES[currentPlan] || "0"}/mo
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Usage cycles renew automatically on the 1st of next month.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Monthly Audits Allowance Progress</span>
                  <span className="font-mono text-primary font-bold">{used} / {isUnlimited ? "∞" : auditLimit}</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  {isUnlimited ? (
                    <div className="h-full w-full bg-gradient-to-r from-purple-500/20 via-primary/40 to-purple-500/20 animate-pulse" />
                  ) : (
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, progressValue)}%` }} />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  Features unlocked: {config.proposals ? "Proposals ✅" : "Proposals ❌"} · {config.whiteLabel ? "White-label ✅" : "White-label ❌"} · {config.teamSeats} Workspace seat(s).
                </p>
              </div>
            </div>
          </section>

          {/* Checkout Selection Board Option Matrix */}
          <section className="card-elevated p-5 bg-slate-900/20 border border-slate-800 rounded-xl space-y-4 shadow-2xl">
            <p className="label-eyebrow text-xs font-bold uppercase text-primary/80 tracking-widest flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Available Upgrade Matrices
            </p>
            <div className="space-y-3">
              {[
                ["starter", "Starter Plan", "$49 / month", "20 monthly checks, complete AI proposal documents, cold sales funnel emails generator access."],
                ["agency", "Agency Hub License", "$99 / month", "Unlimited scans, custom white-label reports, automated compliance certificates, 3 core developer workspace seats."],
                ["business", "Business Network Mesh", "$199 / month", "Unlimited parameters, monthly recurring automated re-audits scheduler, drop-score email triggers, 10 team seats."]
              ].map(([key, label, price, description]) => (
                <div
                  key={key}
                  onClick={() => handleUpgradeCheckout(key)}
                  className={cn(
                    "p-3.5 border rounded-xl space-y-1.5 transition-all cursor-pointer select-none text-left",
                    plan === key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        {label}
                        {plan === key && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary/20 text-primary tracking-wider uppercase">Active</span>
                        )}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{price}</p>
                    </div>
                    {plan !== key && (
                      <Button size="sm" className="bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold h-7 rounded-md px-2.5">
                        Select
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal border-t border-slate-900 pt-1.5">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}