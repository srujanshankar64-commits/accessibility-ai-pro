import React from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

export type AuditResult = {
  compliance_score?: number;
  overall_score?: number;
  violations: any[];
};

type Props = {
  result: AuditResult | null;
  clientUrl: string;
};

export function AuditReport({ result, clientUrl }: Props) {
  if (!result) {
    return (
      <div className="glass-card p-8 rounded-xl border border-border flex flex-col items-center justify-center text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Audit Run Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Select a client and run an audit to view compliance scores and remediation steps.
        </p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 75) return "text-amber-500";
    return "text-destructive";
  };

  const score = result.overall_score ?? result.compliance_score ?? 0;

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-xl border border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Compliance Report</h2>
            <p className="text-sm text-muted-foreground">{clientUrl}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Score</p>
              <p className={`text-4xl font-bold ${getScoreColor(score)}`}>
                {score}<span className="text-xl text-muted-foreground">/100</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl border border-border space-y-6">
        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Remediation Steps
        </h3>
        
        <div className="space-y-4">
          {result.violations.map((v, i) => (
            <div key={i} className="p-4 rounded-lg bg-background/50 border border-border space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-mono text-xs text-accent bg-accent/10 inline-block px-2 py-0.5 rounded break-all">
                    {v.element_affected || v.element || "Document"}
                  </p>
                  <p className="text-sm font-medium text-foreground">{v.name || v.violation}</p>
                </div>
              </div>
              <div className="flex gap-2 items-start text-sm text-muted-foreground bg-card/50 p-3 rounded-md border border-border/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <p><span className="font-medium text-foreground">Fix:</span> {v.fix_instructions || v.fix}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
