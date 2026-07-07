export type Plan = "free" | "starter" | "agency" | "business";

export const PLAN_PRICES = { free: 0, starter: 49, agency: 99, business: 199 };

export const TIER = {
  free:     { audits: 3,      violations: 5,   proposals: false, coldEmail: false, codeFixes: false, certificate: false, bulkCsv: false, historyDays: 7,   whiteLabelPdf: false, multiPageCrawl: false, competitorBenchmark: false, remediationRoadmap: false, complianceVelocity: false, complianceShield: false },
  starter:  { audits: 20,     violations: 999, proposals: true,  coldEmail: true,  codeFixes: false, certificate: false, bulkCsv: false, historyDays: 30,  whiteLabelPdf: false, multiPageCrawl: false, competitorBenchmark: false, remediationRoadmap: false, complianceVelocity: false, complianceShield: false },
  agency:   { audits: 999999, violations: 999, proposals: true,  coldEmail: true,  codeFixes: true,  certificate: true,  bulkCsv: true,  historyDays: 999, whiteLabelPdf: true, multiPageCrawl: false, competitorBenchmark: false, remediationRoadmap: false, complianceVelocity: false, complianceShield: false },
  business: { audits: 999999, violations: 999, proposals: true,  coldEmail: true,  codeFixes: true,  certificate: true,  bulkCsv: true,  historyDays: 999, whiteLabelPdf: true, multiPageCrawl: true, competitorBenchmark: true, remediationRoadmap: true, complianceVelocity: true, complianceShield: true },
} as const;

/**
 * Gets the current plan for a user. 
 * If the email matches the admin email from env var, it forces 'business' for testing.
 */
export function getPlan(raw: string | null | undefined, email?: string): Plan {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && email === adminEmail) return 'business';
  
  if (raw === "starter" || raw === "agency" || raw === "business") return raw;
  return "free";
}

export function canRunAudit(plan: Plan, used: number): boolean {
  const limit = TIER[plan].audits;
  return used < limit;
}
