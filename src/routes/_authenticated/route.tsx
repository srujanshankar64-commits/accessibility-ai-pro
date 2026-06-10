import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ShieldCheck, FileSearch, History, FileText, Settings as SettingsIcon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const nav = [
  { to: "/audit", label: "New Audit", icon: FileSearch },
  { to: "/history", label: "Audit History", icon: History },
  { to: "/proposal", label: "Proposals", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AppLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    supabase.from("settings").select("plan").maybeSingle().then(({ data }) => {
      if (data?.plan) setPlan(data.plan);
    });
  }, []);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (user.email ?? "U")[0]?.toUpperCase();
  const planColor = plan === "free"
    ? "bg-warning/15 text-warning border-warning/30"
    : "bg-primary/15 text-primary border-primary/30";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="gradient-line" />

      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/audit" className="flex items-center gap-2 shrink-0">
            <div className="h-7 w-7 rounded-md bg-primary grid place-items-center">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline font-display text-base">
              AccessAudit<span className="text-primary">AI</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "h-9 px-3 inline-flex items-center rounded-md text-sm transition-colors",
                  isActive(item.to)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className={cn(
              "hidden sm:inline-flex items-center h-6 px-2.5 rounded-full border text-[10px] font-medium uppercase tracking-wider",
              planColor,
            )}>
              {plan} plan
            </span>
            <div className="h-8 w-8 rounded-full bg-accent border border-border grid place-items-center text-xs font-semibold">
              {initials}
            </div>
            <button onClick={signOut} title="Sign out" className="hidden sm:grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 border-t border-border bg-background/95 backdrop-blur flex items-center justify-around">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 h-full flex-1 text-[10px] transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="uppercase tracking-wider">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
