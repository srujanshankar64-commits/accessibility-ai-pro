import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const [agencyName, setAgencyName] = useState("");
  const [brandColor, setBrandColor] = useState("#6E56CF");
  const [plan, setPlan] = useState("free");
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("*").maybeSingle().then(({ data }) => {
      if (!data) return;
      setAgencyName(data.agency_name ?? "");
      setBrandColor(data.brand_color ?? "#6E56CF");
      setPlan(data.plan ?? "free");
      setUsed(data.audits_used ?? 0);
      setLimit(data.audits_limit ?? 10);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      agency_name: agencyName, brand_color: brandColor,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  const inputCls = "w-full h-10 px-3 rounded bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="space-y-10 animate-slide-up max-w-3xl">
      <header>
        <h1 className="font-display text-2xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your agency branding, subscription, and account.</p>
      </header>

      {/* Branding */}
      <section className="card-elevated p-6 space-y-5">
        <div>
          <p className="label-eyebrow">Agency Branding</p>
          <p className="text-xs text-muted-foreground mt-1">Appears on generated proposals and PDF reports.</p>
        </div>

        <div className="border-2 border-dashed border-border rounded-md p-8 text-center bg-background">
          <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Upload logo</p>
          <p className="text-xs text-muted-foreground/70">PNG or SVG · max 2MB</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="label-eyebrow">Agency name</label>
            <input className={inputCls} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="label-eyebrow">Brand color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-12 rounded border border-border bg-background cursor-pointer" />
              <input className={cn(inputCls, "font-mono")} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary-hover text-primary-foreground">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save branding
        </Button>
      </section>

      <div className="h-px bg-border" />

      {/* Subscription */}
      <section className="space-y-5">
        <div>
          <p className="label-eyebrow">Subscription</p>
        </div>
        <div className="card-elevated p-6 space-y-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-primary font-display text-lg uppercase tracking-wide">{plan}</span>
                <span className="text-muted-foreground text-sm">· $0/month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Renews on the 1st of next month</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">Audits used this month</span>
              <span className="font-mono">{used} / {limit}</span>
            </div>
            <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` }} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">Upgrade plan</Button>
            <Button variant="outline" className="border-border hover:bg-accent">Manage billing</Button>
          </div>
        </div>
      </section>

      <div className="h-px bg-border" />

      {/* Account */}
      <section className="space-y-5">
        <div>
          <p className="label-eyebrow">Account</p>
        </div>
        <div className="card-elevated p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="label-eyebrow">Email</label>
            <input value={user.email ?? ""} disabled className={cn(inputCls, "font-mono opacity-70")} />
          </div>
          <Button variant="outline" className="border-border hover:bg-accent">Change password</Button>

          <div className="pt-5 border-t border-border">
            <p className="label-eyebrow text-danger">Danger zone</p>
            <p className="mt-1 text-xs text-muted-foreground">Permanently delete your account and all associated data. This cannot be undone.</p>
            <Button variant="outline" className="mt-3 border-danger/40 text-danger hover:bg-danger/10">Delete account</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
