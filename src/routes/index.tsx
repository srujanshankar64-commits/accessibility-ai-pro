import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck, ScanLine, Check, ArrowRight,
  Code2, LayoutGrid, TrendingUp, Users, Activity, Link2
} from "lucide-react";
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/audit" });
  },
  component: Landing,
});

function ComplianceCalculator() {
  const [clients, setClients] = useState(50);
  
  const agencyTierPrice = 499;
  const manualAuditCostPerSite = 150; 
  const efficiencyGain = 0.85;

  const legacyCost = clients * manualAuditCostPerSite;
  const newCost = agencyTierPrice;
  const monthlySavings = legacyCost - newCost;

  const chartData = {
    labels: ['Infrastructure Cost', 'Agency Profit Margin'],
    datasets: [{
      data: [newCost, Math.max(0, monthlySavings)],
      backgroundColor: ['#333333', '#c5a059'],
      hoverOffset: 4,
      borderWidth: 0
    }]
  };

  return (
    <div className="glass-card p-8 md:p-12 mt-12 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        <div className="lg:col-span-6">
          <h2 className="text-3xl font-display font-bold mb-6">Unit Economics & Calculator</h2>
          <p className="text-stone-400 mb-8 text-sm">
            Model your agency's profitability. Our zero-seat pricing structure means your margins scale exponentially as you add clients.
          </p>
          
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest flex justify-between">
                <span>Active Client Sites</span>
                <span className="text-accent">{clients}</span>
              </label>
              <input 
                type="range" 
                min="5" 
                max="200" 
                step="5"
                value={clients} 
                onChange={(e) => setClients(parseInt(e.target.value))}
                className="w-full mt-4 accent-accent"
              />
            </div>
            
            <div className="p-6 bg-[#252525] rounded-xl border border-white/5">
              <div className="flex justify-between mb-3 border-b border-white/5 pb-3">
                <span className="text-stone-400 text-sm">Legacy Manual Audit Cost</span>
                <span className="font-bold text-muted-foreground">${legacyCost.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between mb-3 border-b border-white/5 pb-3">
                <span className="text-stone-400 text-sm">ARCH.AI Infrastructure (Agency Tier)</span>
                <span className="font-bold text-white">${newCost.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-bold text-white">Projected Monthly Savings</span>
                <span className="font-bold text-accent">${monthlySavings.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-xs text-stone-500 font-mono">
              * Assumes industry average manual audit cost of ${manualAuditCostPerSite}/site and {efficiencyGain * 100}% efficiency gain.
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-6 flex items-center justify-center">
          <div className="w-full max-w-[450px] aspect-square">
            <Doughnut 
              data={chartData} 
              options={{
                cutout: '75%',
                plugins: {
                  legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 20, font: { family: 'Inter' } } }
                }
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent/20">
      
      {/* NAV */}
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tighter">
              ARCH<span className="text-accent">.AI</span>
            </span>
            <span className="hidden md:inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-primary/5 text-primary rounded-sm border border-primary/10">
              Agency Infra
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#platform" className="hover:text-primary transition-colors">Platform</a>
            <a href="#economics" className="hover:text-primary transition-colors">Unit Economics</a>
            <a href="#partner" className="hover:text-primary transition-colors">Partner Program</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden sm:inline-flex text-sm font-medium hover:text-accent transition-colors">Sign in</Link>
            <Link to="/auth" className="h-9 inline-flex items-center px-4 rounded bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-all shadow-sm">
              Get Your Agency Access
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-stone-100 to-transparent -z-10" />
        
        <div className="max-w-[1000px] mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-widest mb-8">
            B2B Compliance Engine v2.0
          </div>
          
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight text-primary mb-6">
            Zero-Risk Compliance Infrastructure <br className="hidden md:block"/>for Digital Agencies.
          </h1>
          
          <p className="mt-6 mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            Replace expensive, high-friction audits with our real-time, white-label compliance engine. Engineered for agencies, not just sites.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth" className="h-12 w-full sm:w-auto inline-flex items-center justify-center px-8 rounded bg-primary hover:bg-primary-hover text-primary-foreground font-medium transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Get Your Agency Access
            </Link>
            <a href="#economics" className="h-12 w-full sm:w-auto inline-flex items-center justify-center px-8 rounded border border-border bg-white hover:bg-stone-50 text-primary font-medium transition-all">
              View Partner Economics
            </a>
          </div>

          <div className="mt-16 pt-8 border-t border-border flex flex-wrap justify-center gap-x-12 gap-y-6 text-sm text-muted-foreground font-medium">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent"/> Full WCAG 2.1 AA</div>
            <div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-accent"/> Developer-ready Fixes</div>
            <div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-accent"/> White-Label Reports</div>
          </div>
        </div>
      </section>

      {/* PLATFORM ADVANTAGES */}
      <section id="platform" className="py-24 bg-white border-y border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">The Triad of Technical Moats</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">We don't compete with overlays. We provide the infrastructure that renders them obsolete without cannibalizing your margin.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-card p-8">
              <div className="h-12 w-12 bg-primary/5 rounded flex items-center justify-center mb-6">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-3">Real-Time Audit Stream</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Legacy scans take days. Our edge functions stream WCAG violations in real-time using Gemini-powered event-chunking.</p>
            </div>
            
            <div className="glass-card p-8 border-accent/30 shadow-[0_0_30px_rgba(197,160,89,0.1)]">
              <div className="h-12 w-12 bg-accent/10 rounded flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-bold text-lg mb-3">Zero-Seat Friction</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Collaborative compliance. No per-seat fees. Scale your QA, design, and dev teams without budget expansion.</p>
            </div>

            <div className="glass-card p-8">
              <div className="h-12 w-12 bg-primary/5 rounded flex items-center justify-center mb-6">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-3">Proactive Drop Alerts</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">We don't wait for audits. We trigger high-priority alerts automatically when your client's code changes degrade compliance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE SHIELD DEMO */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="label-eyebrow mb-3">Client-Facing Widget</p>
              <h2 className="font-display text-4xl font-bold mb-6">Deploy the Compliance Shield.</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Add our lightweight script to your client's site. It monitors their DOM for accessibility regressions in real-time and provides a public-facing badge proving WCAG 2.1 AA compliance.
              </p>
              <ul className="space-y-4">
                {['Live DOM Monitoring', 'Auto-generated Accessibility Statement', 'Agency White-labeling'].map(feature => (
                  <li key={feature} className="flex items-center gap-3 text-sm font-medium">
                    <div className="h-6 w-6 rounded bg-accent/20 flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-accent" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-10 inline-flex items-center gap-2 text-primary font-bold hover:text-accent transition-colors">
                Get Your Shield Embed Code <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-transparent opacity-50 blur-3xl -z-10 rounded-full" />
              <div className="glass-card p-8 border-accent/20 bg-white/60">
                <div className="flex items-center gap-4 mb-6 border-b border-border pb-6">
                  <div className="h-16 w-16 bg-primary rounded-lg flex items-center justify-center shadow-lg">
                    <ShieldCheck className="h-8 w-8 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">WCAG 2.1 AA Protected</h3>
                    <p className="text-sm text-muted-foreground">Monitored by [Your Agency Name]</p>
                  </div>
                </div>
                <div className="space-y-3 font-mono text-xs text-muted-foreground">
                  <p className="text-primary font-bold">{'<script>'}</p>
                  <p className="pl-4">{'window.ARCH_AI_CONFIG = {'}</p>
                  <p className="pl-8 text-accent">{"agencyId: 'YOUR_AGENCY_KEY',"}</p>
                  <p className="pl-8 text-accent">{"theme: 'dark',"}</p>
                  <p className="pl-8 text-accent">{"position: 'bottom-right'"}</p>
                  <p className="pl-4">{'};'}</p>
                  <p className="text-primary font-bold">{'</script>'}</p>
                  <p className="text-primary font-bold">{'<script src="https://cdn.arch.ai/shield.js" async></script>'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ECONOMICS CALCULATOR */}
      <section id="economics" className="py-24 bg-white border-y border-border">
        <div className="max-w-[1000px] mx-auto px-6">
          <ComplianceCalculator />
        </div>
      </section>

      {/* PARTNER PROGRAM */}
      <section id="partner" className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <p className="label-eyebrow mb-3">Partner Program</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold">The Viral Growth Engine</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Turn compliance from a cost center into an automated lead generation channel for your agency.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 text-[120px] opacity-5">⟳</div>
              <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-accent"/> Referral Flywheel
              </h3>
              <div className="space-y-6">
                {[
                  "Install Compliance Shield on client sites as a value-add.",
                  "Site visitors or other businesses click the shield.",
                  "Organic, tracked leads are routed directly to your agency portal.",
                  "Earn platform credits or revenue share upon successful conversion."
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded bg-primary/5 flex items-center justify-center font-bold text-xs text-primary shrink-0 border border-primary/10">
                      {i + 1}
                    </div>
                    <p className="text-sm text-primary leading-relaxed mt-1">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <div className="glass-card p-8 border-accent/20">
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-accent"/> AI Outreach Automation
                </h4>
                <p className="text-sm text-muted-foreground mb-4">Automatically scan your prospects and generate personalized, high-converting audit emails.</p>
                <div className="bg-[#fcfbf9] p-4 rounded border border-border font-mono text-[11px] text-primary leading-relaxed">
                  <span className="text-muted-foreground">Subject:</span> WCAG Exposure Detected on [Prospect Site]<br/><br/>
                  "Your site currently has 14 critical violations. Under the new EAA regulations, this presents immediate liability. I've prepared a white-label remediation roadmap for you..."
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 bg-primary text-primary-foreground text-center">
        <div className="max-w-[700px] mx-auto px-6">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-6">Scale Compliance. <br/>Zero Friction.</h2>
          <p className="text-stone-400 mb-10 text-lg">Join the enterprise standard for agency web accessibility.</p>
          <Link to="/auth" className="h-14 inline-flex items-center px-10 rounded bg-accent hover:bg-[#b08d4b] text-white font-bold transition-all shadow-[0_0_20px_rgba(197,160,89,0.3)] hover:shadow-[0_0_30px_rgba(197,160,89,0.5)]">
            Get Your Agency Access <ArrowRight className="h-5 w-5 ml-2" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#111111] text-stone-500 py-16 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid sm:grid-cols-4 gap-8 mb-12">
            <div className="sm:col-span-2">
              <span className="font-display text-xl font-bold text-white tracking-tighter">
                ARCH<span className="text-accent">.AI</span>
              </span>
              <p className="mt-4 text-sm max-w-sm leading-relaxed">
                Production-ready compliance infrastructure. Built to protect agencies and their clients from digital liability.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">Platform</h4>
              <div className="flex flex-col gap-3 text-sm">
                <a href="#platform" className="hover:text-accent transition-colors">Features</a>
                <a href="#economics" className="hover:text-accent transition-colors">Pricing & Economics</a>
                <a href="#partner" className="hover:text-accent transition-colors">Partner Portal</a>
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">Developers</h4>
              <div className="flex flex-col gap-3 text-sm">
                <a href="#" className="hover:text-accent transition-colors">API Documentation</a>
                <a href="#" className="hover:text-accent transition-colors">Widget Embed Guide</a>
                <a href="#" className="hover:text-accent transition-colors">Security</a>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <p className="font-mono">ARCH.AI | SECURE DATA TERMINAL | VERSION 2.0.26</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
