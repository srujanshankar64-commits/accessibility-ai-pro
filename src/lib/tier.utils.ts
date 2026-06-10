export type Plan = "free" | "starter" | "agency" | "business";

export const PLAN_PRICES = { free: 0, starter: 49, agency: 99, business: 199 };

export const TIER = {
  free:     { audits: 3,       violations: 5,   proposals: false, coldEmail: false, codeFixes: false, certificate: false, bulkCsv: false, teamSeats: 1,  historyDays: 7   },
  starter:  { audits: 20,      violations: 999, proposals: true,  coldEmail: true,  codeFixes: false, certificate: false, bulkCsv: false, teamSeats: 1,  historyDays: 30  },
  agency:   { audits: 999999,  violations: 999, proposals: true,  coldEmail: true,  codeFixes: true,  certificate: true,  bulkCsv: true,  teamSeats: 3,  historyDays: 999 },
  business: { audits: 999999,  violations: 999, proposals: true,  coldEmail: true,  codeFixes: true,  certificate: true,  bulkCsv: true,  teamSeats: 10, historyDays: 999 },
} as const;

export function getPlan(raw: string | null | undefined): Plan {
  if (raw === "starter" || raw === "agency" || raw === "business") return raw;
  return "free";
}

export function canRunAudit(plan: Plan, used: number): boolean {
  const limit = TIER[plan].audits;
  return used < limit;
}