export type Severity = "critical" | "serious" | "moderate" | "minor";

export interface Violation {
  id: string;
  severity: Severity;
  name: string;
  wcag_criterion: string;
  description: string;
  element_affected: string;
  legal_impact: string;
  fix_instructions: string;
}

export interface CategoryScores {
  perceivable: number;
  operable: number;
  understandable: number;
  robust: number;
}

export interface AuditResult {
  overall_score: number;
  category_scores: CategoryScores;
  violations: Violation[];
}

export interface ProposalContent {
  executive_summary: string;
  seo_analysis: string;
  compliance_risk: string;
  violation_summary: string;
  remediation_plan: string;
  investment: string;
  roi_statement: string;
  next_steps: string;
  follow_up_email: string;
  competitive_gap_analysis?: string;
}

