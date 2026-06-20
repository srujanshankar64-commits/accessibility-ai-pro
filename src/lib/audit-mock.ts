// src/lib/audit-mock.ts

export type AuditResult = {
  compliance_score: number;
  violations: Array<{
    element: string;
    violation: string;
    fix: string;
  }>;
};

export function runAudit(url: string): Promise<AuditResult> {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      // Random score between 60 and 95
      const score = Math.floor(Math.random() * (95 - 60 + 1)) + 60;
      
      resolve({
        compliance_score: score,
        violations: [
          {
            element: "<img> on homepage hero",
            violation: "Missing alt text for non-decorative image (WCAG 1.1.1)",
            fix: 'Add descriptive alt="Hero product shot" attribute'
          },
          {
            element: "<button> Submit form",
            violation: "Insufficient color contrast 3.1:1 (WCAG 1.4.3)",
            fix: "Update button background color to a darker shade to meet 4.5:1 ratio"
          },
          {
            element: "<input> Email field",
            violation: "Missing associated form label (WCAG 1.3.1)",
            fix: 'Add a <label for="email"> or aria-label attribute'
          }
        ]
      });
    }, 2000);
  });
}
