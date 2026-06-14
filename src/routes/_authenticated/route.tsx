import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ShieldCheck, LogOut } from "lucide-react";
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
  { to: "/audit", label: "New Audit" },
  { to: "/history", label: "Audit History" },
  { to: "/proposal", label: "Proposals" },
  { to: "/settings", label: "Settings" },
] as const;

function AppLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
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
      <header
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          height: 48,
          zIndex: 1000,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "0.5px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link to="/audit" style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 28, textDecoration: "none" }}>
          <div style={{
            height: 26, width: 26, borderRadius: 8, background: "#1d1d1f",
            display: "grid", placeItems: "center",
          }}>
            <ShieldCheck style={{ height: 13, width: 13, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 14, color: "var(--text-1)", fontWeight: 500, letterSpacing: "-0.01em" }}>
            AccessAudit<span style={{ fontWeight: 200, color: "var(--text-2)" }}> AI</span>
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                fontSize: 12.5,
                padding: "5px 14px",
                borderRadius: 7,
                textDecoration: "none",
                color: isActive(item.to) ? "var(--text-1)" : "var(--text-2)",
                fontWeight: isActive(item.to) ? 500 : 400,
                background: isActive(item.to) ? "#f5f5f7" : "transparent",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { if (!isActive(item.to)) e.currentTarget.style.background = "#f5f5f7"; }}
              onMouseLeave={(e) => { if (!isActive(item.to)) e.currentTarget.style.background = "transparent"; }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 28 }}>
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
          <div style={{
            height: 26, width: 26, borderRadius: "50%",
            background: "#1d1d1f", color: "#fff",
            display: "grid", placeItems: "center",
            fontSize: 11, fontWeight: 500,
          }}>
            {initials}
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className={cn("grid place-items-center")}
            style={{ height: 26, width: 26, borderRadius: 7, background: "transparent", border: "none", color: "var(--text-2)", cursor: "pointer" }}
          >
            <LogOut style={{ height: 14, width: 14 }} />
          </button>
        </div>
      </header>

      <main style={{ paddingTop: 48, minHeight: "100vh" }}>
        <div style={{ padding: "40px 48px" }}>
          <Outlet />
        </div>
      </main>

    </div>
  );
}
