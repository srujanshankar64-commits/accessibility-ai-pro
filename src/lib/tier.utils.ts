export const PLAN_PRICES = { free: 0, starter: 39, agency: 79, reseller: 199 };

export const TIER = {
  free:     { audits: 3,        violations: 5,  proposals: false, coldEmail: false, codeFixes: false, certificate: false },
  starter:  { audits: 20,       violations: 999, proposals: true,  coldEmail: true,  codeFixes: false, certificate: false },
  agency:   { audits: Infinity, violations: 999, proposals: true,  coldEmail: true,  codeFixes: true,  certificate: true  },
  reseller: { audits: Infinity, violations: 999, proposals: true,  coldEmail: true,  codeFixes: true,  certificate: true  },
};

export type Plan = keyof typeof TIER;

export function getPlan(raw: string | null | undefined): Plan {
  if (raw === "starter" || raw === "agency" || raw === "reseller") return raw;
  return "free";
}

export function canRunAudit(plan: Plan, used: number): boolean {
  const limit = TIER[plan].audits;
  return limit === Infinity || used < limit;
}
