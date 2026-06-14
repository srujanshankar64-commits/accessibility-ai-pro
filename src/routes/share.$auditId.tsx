import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/ScoreGauge";
import type { Violation } from "@/lib/audit-types";
import { ArrowLeft, ShieldCheck, Copy, Check, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/share/$auditId")({
  component: ShareAuditPage,
});

function ShareAuditPage() {
  const params = Route.useParams();
  const auditId = params.auditId as string;
  const navigate = useNavigate();
  const [audit, setAudit] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedViolationId, setExpandedViolationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadAudit();
  }, [auditId]);

  const loadAudit = async () => {
    try {
      const { data, error } = await supabase
        .from("audits")
        .select("*")
        .eq("id", auditId)
        .single();
      
      if (error) throw error;
      if (!data) {
        toast.error("Audit not found");
        navigate({ to: "/" });
        return;
      }
      
      setAudit(data);
    } catch (err) {
      toast.error("Failed to load audit");
      navigate({ to: "/" });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedViolationId(expandedViolationId === id ? null : id);
  };

  const copyToClipboard = async (code: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success("Code snippet copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading audit...</p>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Audit not found or access denied</p>
          <Button onClick={() => navigate({ to: "/" })} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="font-display text-lg">Accessibility Audit Report</h1>
              <p className="text-xs text-muted-foreground">{audit.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span>Generated {new Date(audit.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <ScoreGauge score={audit.overall_score} />

        <div className="card-elevated">
          <div className="px-5 py-4 border-b border-border">
            <p className="label-eyebrow">Identified violations</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(audit.violations as Violation[]).length} violations found
            </p>
          </div>

          <div className="p-3 space-y-1">
            {((audit.violations as unknown) as Violation[]).map((v: any) => {
              const isExpanded = expandedViolationId === v.id;
              const fixDescription = v.fix_instructions || v.description || "Remediation needed.";
              const codeFixCode = v.code_fix || v.suggested_fix || null;

              return (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-md border border-transparent transition-all overflow-hidden",
                    isExpanded ? "bg-accent/30 border-border/60 shadow-inner" : "hover:bg-accent/40"
                  )}
                >
                  <div
                    onClick={() => toggleExpand(v.id)}
                    className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                      <div className="mt-1 text-muted-foreground shrink-0">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{v.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded text-muted-foreground border border-border">
                            {v.wcag_criterion}
                          </span>
                          <span className={cn(
                            "text-[9px] uppercase px-1.5 py-0.5 rounded-full font-extrabold tracking-wider border",
                            v.severity === "critical" ? "bg-danger/10 text-danger border-danger/20" :
                            v.severity === "serious" ? "bg-warning/10 text-warning border-warning/20" :
                            v.severity === "moderate" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            "bg-muted text-muted-foreground border-border"
                          )}>
                            {v.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50 mt-2">
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Issue</p>
                        <p>{fixDescription}</p>
                      </div>

                      {codeFixCode && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-foreground">Suggested fix</p>
                            <button
                              onClick={(e) => copyToClipboard(codeFixCode, v.id, e)}
                              className="text-xs text-primary hover:text-primary-hover flex items-center gap-1"
                            >
                              {copiedId === v.id ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                            </button>
                          </div>
                          <pre className="bg-slate-950 text-slate-100 p-3 rounded-md text-xs font-mono overflow-x-auto border border-border">
                            {codeFixCode}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Powered by AccessAudit AI — WCAG 2.1 Compliance Scanner
          </p>
        </div>
      </main>
    </div>
  );
}
