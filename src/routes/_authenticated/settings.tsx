import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, Eye, EyeOff, Lock, Zap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPlan, TIER, PLAN_PRICES } from "@/lib/tier.utils";
import { createCheckoutSession } from "../-api.checkout";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const PLAN_LABELS: Record<string, string> = {
  free: "Free Plan",
  starter: "Starter Plan",
  agency: "Agency Hub",
  business: "Business Enterprise",
};

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const [agencyName, setAgencyName] = useState("");
  const [brandColor, setBrandColor] = useState("#6E56CF");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [plan, setPlan] = useState<"free" | "starter" | "agency" | "business">("business");
  const [used, setUsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [settingPlan, setSettingPlan] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    (supabase as any).from("settings").select("*").maybeSingle().then(({ data }: { data: any }) => {
      if (!data) return;
      setSettings(data);
      setAgencyName(data.agency_name ?? "");
      setBrandColor(data.brand_color ?? "#6E56CF");
      setApiKey(data.gemini_api_key ?? "");
      setPlan((data.plan as any) ?? "free");
      setUsed(data.audits_used ?? 0);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("settings")
      .upsert({
        user_id: user.id,
        agency_name: agencyName,
        brand_color: brandColor,
        gemini_api_key: apiKey,
      });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Settings saved successfully");
    }
  };

  const setDevPlan = async (targetPlan: string) => {
    setSettingPlan(true);
    const { error } = await (supabase as any)
      .from("settings")
      .upsert({
        user_id: user.id,
        plan: targetPlan,
        audits_used: 0,
      });
    setSettingPlan(false);
    if (error) {
      toast.error(error.message);
    } else {
      setPlan(targetPlan as any);
      toast.success(`Plan set to ${targetPlan}!`);
    }
  };

  const handleUpgradeCheckout = async (tierName: string) => {
    try {
      const productIds: Record<string, string> = {
        starter: process.env.NEXT_PUBLIC_DODO_STARTER_ID || "pdt_0Ngl3vET02otEHOXHqvAx",
        agency: process.env.NEXT_PUBLIC_DODO_AGENCY_ID || "pdt_0Ngl4mgraS8OdTZY3yGQN",
        business: process.env.NEXT_PUBLIC_DODO_BUSINESS_ID || "pdt_0Ngl5RCV0T6Vc40K5mtdr",
      };

      const productId = productIds[tierName];
      if (!productId) {
        toast.error(`No product ID found for ${tierName} plan`);
        return;
      }

      const result = await createCheckoutSession({ data: { productId, tier: tierName } });
      
      if (result.success && result.checkout_url) {
        window.location.href = result.checkout_url;
      } else if (result.success === false && result.error) {
        toast.error(`Checkout Error: ${result.error}. Dodo Payments account may be under review (24-48 hours).`);
      } else {
        throw new Error("Invalid response from checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(`${error instanceof Error ? error.message : "Failed to initiate checkout"}. Account may be under review.`);
    }
  };

  const currentPlan = getPlan(plan);
  const config = TIER[currentPlan];
  const auditLimit = config.audits;
  const isUnlimited = auditLimit >= 999999;
  const upgradeDate = settings?.updated_at ? new Date(settings.updated_at) : new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 1);
  const progressValue = isUnlimited ? 100 : (used / auditLimit) * 100;
  const hasBrandingAccess = currentPlan === "agency" || currentPlan === "business";

  const inputCls = "w-full h-10 px-3 rounded bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";

  return (
    <div className="space-y-10 animate-slide-up max-w-5xl mx-auto p-4 sm:p-6 text-slate-100">
      <header>
        <h1 className="font-display text-2xl text-white">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your agency branding, active integrations, and subscription billing profiles.</p>
      </header>

      {/* DEV TOOL - Remove before public launch */}
      <section className="p-4 border border-dashed border-purple-500/40 rounded-xl bg-purple-950/10 space-y-3">
        <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">Dev Tools — Set Plan for Testing</p>
        <div className="flex flex-wrap gap-2">
          {["free", "starter", "agency", "business"].map((p) => (
            <button
              key={p}
              onClick={() => setDevPlan(p)}
              disabled={settingPlan || currentPlan === p}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md font-semibold border transition-all",
                currentPlan === p
                  ? "border-purple-500 bg-purple-500/20 text-purple-300"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-purple-500 hover:text-purple-300"
              )}
            >
              {currentPlan === p ? `✓ ${p}` : `Set ${p}`}
            </button>
          ))}
          {settingPlan && <Loader2 className="h-4 w-4 animate-spin text-purple-400 self-center" />}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
        <div className="space-y-8">

          {/* Agency Branding */}
          <section className="card-elevated p-6 space-y-5 relative overflow-hidden bg-slate-900/40 border border-slate-800 rounded-xl">
            {!hasBrandingAccess && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1.5px] z-10 flex flex-col items-center justify-center p-6 text-center">
                <Lock className="h-5 w-5 text-purple-400 mb-2" />
                <h3 className="text-sm font-bold text-white">White-Label Branding Locked</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">Requires Agency plan or higher.</p>
                <Button size="sm" onClick={() => handleUpgradeCheckout("agency")} className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs h-9 px-4">
                  Unlock Branding
                </Button>
              </div>
            )}

            <div>
              <p className="text-sm font-bold tracking-wide">Agency Branding</p>
              <p className="text-xs text-muted-foreground mt-1">Appears on generated proposals and white-label PDF exports.</p>
            </div>

            <div className="border-2 border-dashed border-slate-800 rounded-md p-6 text-center bg-background/50">
              <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Upload agency logo</p>
              <p className="text-xs text-muted-foreground/70">PNG or SVG · max 2MB</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Agency name</label>
                <input className={inputCls} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} disabled={!hasBrandingAccess} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Brand color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} disabled={!hasBrandingAccess} className="h-10 w-12 rounded border border-border bg-background cursor-pointer disabled:opacity-50" />
                  <input className={cn(inputCls, "font-mono")} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} disabled={!hasBrandingAccess} />
                </div>
              </div>
            </div>
          </section>

          {/* AI API Key */}
          <section className="card-elevated p-6 space-y-4 bg-slate-900/40 border border-slate-800 rounded-xl">
            <div>
              <p className="text-sm font-bold tracking-wide">AI Engine API Key</p>
              <p className="text-xs text-muted-foreground mt-1">Optional. Leave blank to use the AccessAudit AI shared gateway.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Gemini API Key (Google AI Studio)</label>
              <div className="relative">
                <input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={cn(inputCls, "font-mono pr-10")} placeholder="AIzaSy..." />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-300">
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

          {/* Account */}
          <section className="space-y-4">
            <p className="text-sm font-bold tracking-wide">Account Profile</p>
            <div className="card-elevated p-6 space-y-5 bg-slate-900/40 border border-slate-800 rounded-xl">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Email</label>
                <input value={user.email ?? ""} disabled className={cn(inputCls, "font-mono opacity-70")} />
              </div>
              <Button variant="outline" className="border-slate-800 hover:bg-slate-800 text-slate-300">Change password</Button>
              <div className="pt-5 border-t border-slate-800">
                <p className="text-red-400 font-semibold text-sm">Danger Zone</p>
                <p className="mt-1 text-xs text-muted-foreground">Permanently delete your account and all data. This cannot be undone.</p>
                <Button variant="outline" className="mt-3 border-red-500/30 text-red-400 hover:bg-red-500/10">Delete account</Button>
              </div>
            </div>
          </section>
        </div>

        {/* Right sidebar - Plan */}
        <div className="space-y-6">
          <section className="space-y-4">
            <p className="text-sm font-bold tracking-wide">Active Plan</p>
            <div className="card-elevated p-6 space-y-5 bg-slate-900/40 border border-slate-800 rounded-xl">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-primary font-display text-lg uppercase font-bold tracking-wider">
                      {PLAN_LABELS[currentPlan] || currentPlan}
                    </span>
                    <span className="text-muted-foreground text-xs font-mono">
                      · ${PLAN_PRICES[currentPlan] ?? 0}/mo
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Renews on {expiryDate.toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Audits used this month</span>
                  <span className="font-mono text-primary font-bold">{used} / {isUnlimited ? "∞" : auditLimit}</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  {isUnlimited ? (
                    <div className="h-full w-full bg-gradient-to-r from-purple-500/20 via-primary/40 to-purple-500/20 animate-pulse" />
                  ) : (
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, progressValue)}%` }} />
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  {config.proposals ? "✅ Proposals" : "❌ Proposals"} · {config.coldEmail ? "✅ Cold email" : "❌ Cold email"} · {config.codeFixes ? "✅ Code fixes" : "❌ Code fixes"} · {config.teamSeats} seat(s)
                </p>
              </div>
            </div>
          </section>

          {/* Upgrade options */}
          <section className="card-elevated p-5 bg-slate-900/20 border border-slate-800 rounded-xl space-y-4">
            <p className="text-xs font-bold uppercase text-primary/80 tracking-widest flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Upgrade Options
            </p>
            <div className="space-y-3">
              {([
                ["starter", "Starter Plan", "$49/mo", "20 audits, full violation list, proposals, cold email drafts."],
                ["agency", "Agency Hub", "$99/mo", "Unlimited audits, white-label PDF, code fixes, certificates, 3 seats."],
                ["business", "Business Enterprise", "$199/mo", "Everything + auto re-audits, score alerts, 10 seats, bulk proposals."],
              ] as const).map(([key, label, price, description]) => (
                <div
                  key={key}
                  onClick={() => handleUpgradeCheckout(key)}
                  className={cn(
                    "p-3.5 border rounded-xl space-y-1.5 transition-all cursor-pointer",
                    currentPlan === key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        {label}
                        {currentPlan === key && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary/20 text-primary tracking-wider uppercase">Active</span>
                        )}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{price}</p>
                    </div>
                    {currentPlan !== key && (
                      <Button size="sm" className="bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 text-[10px] font-bold h-7 px-2.5">
                        Select
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground border-t border-slate-900 pt-1.5">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}