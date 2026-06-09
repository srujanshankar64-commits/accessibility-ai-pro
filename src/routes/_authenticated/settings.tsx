import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const [agencyName, setAgencyName] = useState("");
  const [brandColor, setBrandColor] = useState("#6C63FF");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [plan, setPlan] = useState("free");
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("*").maybeSingle().then(({ data }) => {
      if (!data) return;
      setAgencyName(data.agency_name ?? "");
      setBrandColor(data.brand_color ?? "#6C63FF");
      setApiKey(data.gemini_api_key ?? "");
      setPlan(data.plan ?? "free");
      setUsed(data.audits_used ?? 0);
      setLimit(data.audits_limit ?? 10);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      agency_name: agencyName, brand_color: brandColor, gemini_api_key: apiKey,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };

  return (
    <div className="space-y-8 animate-slide-up max-w-3xl">
      <header>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your agency branding, integrations, and account.</p>
      </header>

      <section className="card-elevated p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg">Agency branding</h2>
          <p className="text-sm text-muted-foreground">Appears on generated proposals and reports.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="label-eyebrow">Agency name</Label>
            <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="label-eyebrow">Primary brand color</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-11 w-14 rounded-md bg-input border border-border cursor-pointer" />
              <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="font-mono" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="label-eyebrow">Logo</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Drag and drop a PNG/SVG, or click to upload (coming soon)
          </div>
        </div>
      </section>

      <section className="card-elevated p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg">API configuration</h2>
          <p className="text-sm text-muted-foreground">Optional — by default audits use the built-in Lovable AI gateway.</p>
        </div>
        <div className="space-y-2">
          <Label className="label-eyebrow">Gemini API key (optional)</Label>
          <div className="relative">
            <Input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono pr-10" placeholder="AIza..." />
            <button onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Your key is stored securely and never shared.</p>
        </div>
      </section>

      <section className="card-elevated p-6 space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-display text-lg">Subscription</h2>
            <p className="text-sm text-muted-foreground">Current plan and usage.</p>
          </div>
          <span className="rounded-full bg-primary/15 text-primary text-[10px] font-medium uppercase tracking-wider px-3 py-1 border border-primary/30">{plan} plan</span>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Audits used this month</span>
            <span className="font-mono">{used} / {limit}</span>
          </div>
          <Progress value={(used / Math.max(limit, 1)) * 100} className="h-2" />
        </div>
        <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">Upgrade plan</Button>
      </section>

      <section className="card-elevated p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg">Account</h2>
        </div>
        <div className="space-y-2">
          <Label className="label-eyebrow">Email</Label>
          <Input value={user.email ?? ""} disabled className="font-mono" />
        </div>
        <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10">Delete account</Button>
      </section>

      <div className="sticky bottom-4 z-10">
        <div className="card-elevated p-3 px-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Changes to branding and API key are saved together.</p>
          <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary-hover text-primary-foreground">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
