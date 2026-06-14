import { supabase } from "@/integrations/supabase/client";

interface AuditData {
  overall_score: number;
  violations: any[];
  url: string;
}

interface BenchmarkResult {
  clientScore: number;
  competitorScore: number;
  scoreGap: number;
  clientViolations: number;
  competitorViolations: number;
  criticalGap: number;
  seriousGap: number;
  recommendation: string;
}

/**
 * Runs competitor benchmark audit
 */
export async function runBenchmarkAudit(competitorUrl: string): Promise<AuditData> {
  // This would call your existing audit function
  // For now, return a placeholder
  const { data, error } = await supabase
    .from('audits')
    .select('overall_score, violations, url')
    .eq('url', competitorUrl)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    // Return placeholder if no existing audit
    return {
      overall_score: 0,
      violations: [],
      url: competitorUrl,
    };
  }
  
  return data as AuditData;
}

/**
 * Compares client and competitor audits
 */
export function compareAudits(clientAudit: AuditData, competitorAudit: AuditData): BenchmarkResult {
  const clientViolations = Array.isArray(clientAudit.violations) ? clientAudit.violations : [];
  const competitorViolations = Array.isArray(competitorAudit.violations) ? competitorAudit.violations : [];
  
  const clientCritical = clientViolations.filter((v: any) => v.severity === 'critical').length;
  const competitorCritical = competitorViolations.filter((v: any) => v.severity === 'critical').length;
  
  const clientSerious = clientViolations.filter((v: any) => v.severity === 'serious').length;
  const competitorSerious = competitorViolations.filter((v: any) => v.severity === 'serious').length;
  
  const scoreGap = clientAudit.overall_score - competitorAudit.overall_score;
  
  let recommendation = '';
  
  if (scoreGap > 20) {
    recommendation = 'Your client significantly outperforms the competitor. Use this as a selling point for their accessibility leadership.';
  } else if (scoreGap > 0) {
    recommendation = 'Your client has a slight accessibility advantage over the competitor. Highlight this competitive edge.';
  } else if (scoreGap > -20) {
    recommendation = 'Your client is slightly behind the competitor. Address critical issues to close the gap.';
  } else {
    recommendation = 'Your client significantly lags behind the competitor. This is an urgent opportunity to demonstrate value through remediation.';
  }
  
  return {
    clientScore: clientAudit.overall_score,
    competitorScore: competitorAudit.overall_score,
    scoreGap,
    clientViolations: clientViolations.length,
    competitorViolations: competitorViolations.length,
    criticalGap: clientCritical - competitorCritical,
    seriousGap: clientSerious - competitorSerious,
    recommendation,
  };
}

/**
 * Generates competitive gap analysis for AI prompt
 */
export function generateCompetitiveAnalysis(benchmark: BenchmarkResult): string {
  return `
COMPETITIVE BENCHMARK ANALYSIS:
- Client Score: ${benchmark.clientScore}/100
- Competitor Score: ${benchmark.competitorScore}/100
- Score Gap: ${benchmark.scoreGap > 0 ? '+' : ''}${benchmark.scoreGap}
- Client Violations: ${benchmark.clientViolations}
- Competitor Violations: ${benchmark.competitorViolations}
- Critical Issue Gap: ${benchmark.criticalGap > 0 ? '+' : ''}${benchmark.criticalGap}
- Serious Issue Gap: ${benchmark.seriousGap > 0 ? '+' : ''}${benchmark.seriousGap}

RECOMMENDATION: ${benchmark.recommendation}
`;
}
