import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — AccessAudit AI" }] }),
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: name, agency_name: agency },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome aboard.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Left: brand panel */}
      <div className="hidden md:flex flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(800px circle at 20% 20%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 60%)" }} />
        <div className="relative flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary grid place-items-center glow-primary">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg tracking-tight">AccessAudit AI</span>
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl leading-tight">
            Turn your client's legal liability into your next invoice.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md">
            Audit any website for WCAG 2.1 violations in 60 seconds and generate a branded compliance proposal you can send today.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              "96% of websites fail WCAG",
              "EU law since June 2025",
              "Only 4 competitors, all enterprise-priced",
            ].map((s) => (
              <span key={s} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted-foreground">Trusted by agencies in 🇦🇺 🇨🇦 🇬🇧</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl">
            {mode === "login" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Welcome back. Let's audit something." : "Start free. No credit card required."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label className="label-eyebrow">Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ada Lovelace" />
                </div>
                <div className="space-y-2">
                  <Label className="label-eyebrow">Agency name</Label>
                  <Input value={agency} onChange={(e) => setAgency(e.target.value)} required placeholder="Pixel Forge Studio" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label className="label-eyebrow">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@agency.com" />
            </div>
            <div className="space-y-2">
              <Label className="label-eyebrow">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Sign in" : "Create free account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:text-primary-hover font-medium">Start free</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:text-primary-hover font-medium">Sign in</button>
              </>
            )}
          </p>
          <p className="mt-8 text-xs text-muted-foreground text-center">
            <Link to="/" className="hover:text-foreground">← Back home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
