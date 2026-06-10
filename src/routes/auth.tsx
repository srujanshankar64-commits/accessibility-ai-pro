import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name, agency_name: agency } },
        });
        if (error) throw error;
        toast.success("Account created.");
        navigate({ to: "/audit" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: "/audit" });
      }
    } catch (err: any) {
      const msg = err?.message ?? "Authentication failed";
      setErrorMsg(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const inputCls = "w-full h-10 px-3 rounded bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card transition-all";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      <div className="gradient-line" />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(600px circle at 50% 30%, rgba(110,86,207,0.06), transparent 70%)" }}
      />

      <div className="relative w-full max-w-[420px]">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-md bg-primary grid place-items-center">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg">AccessAudit<span className="text-primary">AI</span></span>
        </Link>

        <div className="rounded-xl bg-card border border-border p-10">
          {/* Toggle */}
          <div className="bg-background border border-border rounded-md p-1 flex">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setErrorMsg(null); }}
                className={cn(
                  "flex-1 h-8 text-xs font-medium rounded transition-colors",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <label className="label-eyebrow">Full name</label>
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ada Lovelace" />
                </div>
                <div className="space-y-1.5">
                  <label className="label-eyebrow">Agency name</label>
                  <input className={inputCls} value={agency} onChange={(e) => setAgency(e.target.value)} required placeholder="Pixel Forge Studio" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <label className="label-eyebrow">Email</label>
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@agency.com" />
            </div>
            <div className="space-y-1.5">
              <label className="label-eyebrow">Password</label>
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>

            {errorMsg && (
              <div role="alert" className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors inline-flex items-center justify-center disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By signing up you agree to our <a href="#" className="text-foreground hover:text-primary">Terms of Service</a>.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back home</Link>
        </p>
      </div>
    </div>
  );
}
