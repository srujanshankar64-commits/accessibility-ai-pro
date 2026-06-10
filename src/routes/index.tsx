import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck, Link2, ScanLine, FileText, Check, ArrowRight,
  Code2, FileBadge, UploadCloud, RefreshCw, Award, LayoutGrid,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/audit" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="gradient-line" />

      {/* NAV */}
      <header className="border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary grid place-items-center">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base">
              AccessAudit<span className="text-primary">AI</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#how" className="hover:text-foreground transition-colors">For Agencies</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline-flex h-9 items-center px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Sign in</Link>
            <Link to="/auth" className="h-9 inline-flex items-center px-4 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors">Start free audit</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute left-1/2 top-20 -translate-x-1/2 h-[640px] w-[1100px] pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(110,86,207,0.10), transparent 70%)" }}
        />
        <div className="relative max-w-[1100px] mx-auto px-6 pt-24 pb-20 text-center">
          <h1 className="font-display text-[44px] sm:text-[56px] leading-[1.05] max-w-3xl mx-auto" style={{ letterSpacing: "-0.04em" }}>
            Your clients' websites are breaking the law.
          </h1>
          <p className="mt-6 mx-auto max-w-[520px] text-[20px] text-[color:var(--muted-foreground)] leading-relaxed">
            AccessAudit AI scans for WCAG 2.1 violations and generates a ready-to-send compliance proposal in 60 seconds. Built for agencies.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="h-12 inline-flex items-center px-6 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors">
              Start auditing free
            </Link>
            <a href="#pricing" className="h-12 inline-flex items-center px-6 rounded-md border border-border hover:bg-accent text-sm font-medium transition-colors">
              See a sample report
            </a>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {[
              "96% of websites fail WCAG",
              "EU law enforced June 2025",
              "3,117 US lawsuits in 2025",
            ].map((s) => (
              <span key={s} className="inline-flex items-center h-8 px-3 rounded-full border border-border bg-card text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-y border-border">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-center gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
          <span>Trusted by agencies in</span>
          <span>🇦🇺 Australia</span>
          <span>·</span>
          <span>🇬🇧 United Kingdom</span>
          <span>·</span>
          <span>🇨🇦 Canada</span>
          <span>·</span>
          <span>🇺🇸 United States</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="label-eyebrow text-center">How it works</p>
          <h2 className="font-display text-3xl sm:text-4xl text-center mt-3">From URL to invoice in 60 seconds.</h2>

          <div className="mt-14 grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 items-stretch">
            {[
              { n: "01", icon: Link2, title: "Paste any URL", body: "Drop in your client's website address. No setup, no extensions." },
              { n: "02", icon: ScanLine, title: "AI runs the audit", body: "Gemini scans 25+ WCAG checkpoints across all four compliance categories." },
              { n: "03", icon: FileText, title: "Send the proposal", body: "Download a branded PDF proposal ready to send to your client in 60 seconds." },
            ].map((step, i, arr) => (
              <>
                <div key={step.n} className="card-elevated p-6 relative">
                  <span className="absolute top-4 left-4 h-6 px-2 rounded-full bg-primary/15 text-primary text-[10px] font-medium tracking-wider border border-primary/30 inline-flex items-center">
                    {step.n}
                  </span>
                  <div className="mt-10 h-10 w-10 rounded-md bg-primary/10 border border-primary/20 grid place-items-center text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
                {i < arr.length - 1 && (
                  <div key={`a-${i}`} className="hidden md:grid place-items-center text-muted-foreground">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="label-eyebrow text-center">Everything agencies need</p>
          <h2 className="font-display text-3xl sm:text-4xl text-center mt-3">A compliance product, not a checker.</h2>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: LayoutGrid, title: "25+ WCAG checks", body: "Perceivable, Operable, Understandable, Robust. Every category covered." },
              { icon: Code2, title: "AI code fixes", body: "Exact code snippets to fix every violation. Send to your developer instantly." },
              { icon: FileBadge, title: "White-label PDF", body: "Your agency logo, your brand colors on every compliance report." },
              { icon: UploadCloud, title: "Bulk CSV upload", body: "Audit your entire client portfolio in one go." },
              { icon: RefreshCw, title: "Auto re-audits", body: "Monthly monitoring with alerts when a client's score drops." },
              { icon: Award, title: "Compliance certificate", body: "Downloadable certificate proving WCAG 2.1 AA compliance." },
            ].map((f) => (
              <div key={f.title} className="card-elevated p-6">
                <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/20 grid place-items-center text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-5 text-sm font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="label-eyebrow text-center">Pricing</p>
          <h2 className="font-display text-3xl sm:text-4xl text-center mt-3">Pay once per month. Sell compliance services forever.</h2>
          <p className="mt-3 text-center text-muted-foreground">Every plan includes a 14-day free trial. No credit card required to start.</p>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PriceCard
              tier="FREE"
              price="$0"
              tagline="Try before you commit"
              features={["3 audits per month", "Compliance score", "5 violations preview", "Watermarked PDF"]}
              cta="Start for free"
              variant="ghost"
            />
            <PriceCard
              tier="STARTER"
              price="$49"
              tagline="For solo freelancers"
              features={["20 audits per month", "Full violation list (25+)", "Clean PDF export", "Proposal generator", "Cold email drafts", "30-day audit history"]}
              cta="Get started"
              variant="ghost"
            />
            <PriceCard
              tier="AGENCY"
              price="$99"
              tagline="For growing agencies"
              features={["Unlimited audits", "White-label PDF branding", "AI code fix suggestions", "Bulk CSV upload", "Compliance certificates", "3 team seats", "Full audit history"]}
              cta="Start free trial"
              variant="primary"
              popular
            />
            <PriceCard
              tier="BUSINESS"
              price="$199"
              tagline="For medium agencies"
              features={["Everything in Agency", "Auto monthly re-audits", "Score drop email alerts", "Bulk proposal generation", "10 team seats", "Performance dashboard", "Priority support"]}
              cta="Start free trial"
              variant="ghost"
            />
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">All plans include a 14-day free trial. Cancel anytime. No contracts.</p>
        </div>
      </section>

      {/* LEGAL URGENCY */}
      <section className="py-24 border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="card-elevated p-8 sm:p-10 relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            <h2 className="font-display text-2xl sm:text-3xl pl-2">The law changed. Most agencies don't know yet.</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-6 pl-2">
              {[
                { flag: "🇪🇺", title: "EU Accessibility Act", body: "Enforced June 2025. Fines up to €100,000 per violation." },
                { flag: "🇺🇸", title: "US ADA Title II", body: "Compliance deadline April 2026. 3,117 lawsuits filed in 2025." },
                { flag: "🇬🇧", title: "UK Equality Act", body: "Applies to all digital services. No opt-out for SMBs." },
              ].map((c) => (
                <div key={c.title}>
                  <div className="text-2xl">{c.flag}</div>
                  <h3 className="mt-3 text-sm font-medium">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 border-t border-border text-center">
        <div className="max-w-[700px] mx-auto px-6">
          <h2 className="font-display text-3xl sm:text-4xl">Start your first audit in 60 seconds.</h2>
          <p className="mt-3 text-muted-foreground">Free forever. No credit card. No setup.</p>
          <Link to="/auth" className="mt-8 h-12 inline-flex items-center px-6 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors">
            Audit a website now <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-12">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-6 items-start text-sm">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary grid place-items-center">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="font-display">AccessAudit<span className="text-primary">AI</span></span>
              </div>
              <p className="mt-3 text-muted-foreground text-xs">WCAG compliance for modern agencies.</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 sm:justify-center text-muted-foreground text-xs">
              <a href="#features" className="hover:text-foreground">Features</a>
              <a href="#pricing" className="hover:text-foreground">Pricing</a>
              <a href="#" className="hover:text-foreground">Privacy Policy</a>
              <a href="#" className="hover:text-foreground">Terms of Service</a>
            </div>
            <p className="text-muted-foreground text-xs sm:text-right">Made for agencies in AU, UK, CA, US</p>
          </div>
          <p className="mt-10 text-center text-xs text-muted-foreground">© 2025 AccessAudit AI. Built to make the web accessible.</p>
        </div>
      </footer>
    </div>
  );
}

function PriceCard({
  tier, price, tagline, features, cta, variant, popular,
}: {
  tier: string; price: string; tagline: string; features: string[];
  cta: string; variant: "ghost" | "primary"; popular?: boolean;
}) {
  return (
    <div
      className="relative rounded-lg p-6 flex flex-col"
      style={{
        background: popular ? "#161618" : "#111113",
        border: popular ? "1.5px solid #6E56CF" : "1px solid #1F1F23",
      }}
    >
      {popular && (
        <span className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px] font-medium tracking-wider px-2 py-1 rounded-full uppercase">
          Most Popular
        </span>
      )}
      <span className="label-eyebrow">{tier}</span>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-4xl">{price}</span>
        <span className="text-sm text-muted-foreground">/month</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
      <div className="my-5 h-px bg-border" />
      <ul className="space-y-2.5 text-sm flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/auth"
        className={
          "mt-6 h-10 inline-flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors " +
          (variant === "primary"
            ? "bg-primary hover:bg-primary-hover text-primary-foreground"
            : "border border-border hover:bg-accent")
        }
      >
        {cta}
      </Link>
    </div>
  );
}
