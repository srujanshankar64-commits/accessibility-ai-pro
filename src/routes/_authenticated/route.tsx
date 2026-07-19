import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ShieldCheck, LogOut, LayoutDashboard, ScanLine, History, FileText, Settings as SettingsIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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
  { to: "/dashboard", label: "Agency Engine", short: "Home", Icon: LayoutDashboard },
  { to: "/audit", label: "New Audit", short: "Audit", Icon: ScanLine },
  { to: "/history", label: "Audit History", short: "History", Icon: History },
  { to: "/proposal", label: "Proposals", short: "Proposals", Icon: FileText },
  { to: "/settings", label: "Settings", short: "Settings", Icon: SettingsIcon },
] as const;

function AppLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    supabase.from("settings").select("plan").maybeSingle().then(({ data }) => {
      if (data && 'plan' in data) setPlan((data as any).plan);
    });
  }, []);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (user.email ?? "U")[0]?.toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-subtle)" }}>
      {/* Top bar — iOS-style navigation bar */}
      <header
        className="safe-top"
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          height: isMobile ? 52 : 48,
          zIndex: 1000,
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "0.5px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: isMobile ? 16 : 28,
          paddingRight: isMobile ? 12 : 28,
        }}
      >
        <Link to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            height: 28, width: 28, borderRadius: 8, background: "#1d1d1f",
            display: "grid", placeItems: "center",
          }}>
            <ShieldCheck style={{ height: 14, width: 14, color: "#fff" }} />
          </div>
          <span style={{ fontSize: isMobile ? 15 : 14, color: "var(--text-1)", fontWeight: 600, letterSpacing: "-0.02em" }}>
            AccessAudit<span style={{ fontWeight: 300, color: "var(--text-2)" }}> AI</span>
          </span>
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {nav.map((item) => (
              <Link
                key={item.label}
                to={item.to as any}
                style={{
                  fontSize: 12.5,
                  padding: "5px 14px",
                  borderRadius: 7,
                  textDecoration: "none",
                  color: isActive(item.to) ? "var(--text-1)" : "var(--text-2)",
                  fontWeight: isActive(item.to) ? 500 : 400,
                  background: isActive(item.to) ? "#f5f5f7" : "transparent",
                }}
                onMouseEnter={(e) => { if (!isActive(item.to)) e.currentTarget.style.background = "#f5f5f7"; }}
                onMouseLeave={(e) => { if (!isActive(item.to)) e.currentTarget.style.background = "transparent"; }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 10 }}>
          {!isMobile && (
            <span style={{
              fontSize: 11,
              background: "#f5f5f7",
              border: "0.5px solid var(--border)",
              borderRadius: 20,
              padding: "4px 12px",
              color: "var(--text-2)",
              textTransform: "capitalize",
            }}>
              {plan} plan
            </span>
          )}
          <div style={{
            height: 28, width: 28, borderRadius: "50%",
            background: "#1d1d1f", color: "#fff",
            display: "grid", placeItems: "center",
            fontSize: 12, fontWeight: 500,
          }}>
            {initials}
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            style={{ height: 32, width: 32, borderRadius: 8, background: "transparent", border: "none", color: "var(--text-2)", cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <LogOut style={{ height: 16, width: 16 }} />
          </button>
        </div>
      </header>

      <main
        style={{
          paddingTop: isMobile ? 52 : 48,
          paddingBottom: isMobile ? 68 : 0,
          minHeight: "100vh",
        }}
      >
        <div style={{ padding: isMobile ? "20px 16px" : "40px 48px" }}>
          <Outlet />
        </div>
      </main>

      {/* iOS bottom tab bar (mobile only) */}
      {isMobile && (
        <nav className="ios-tabbar" aria-label="Primary">
          <div className="ios-tabbar-inner">
            {nav.map(({ to, short, Icon }) => (
              <Link key={to} to={to as any} className="ios-tab" data-active={isActive(to)}>
                <Icon />
                <span>{short}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
