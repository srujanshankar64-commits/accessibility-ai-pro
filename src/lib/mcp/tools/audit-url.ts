import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "audit_url",
  title: "Audit URL for accessibility",
  description:
    "Run a fast WCAG 2.1 AA accessibility audit against a public URL and return violations grouped by severity.",
  inputSchema: {
    url: z.string().url().describe("Public URL to audit."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ url }) => {
    const { performFastAudit } = await import("@/lib/fastAudit");
    try {
      const result = await (performFastAudit as any)({ data: { url } });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: { result },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: `Audit failed: ${message}` }], isError: true };
    }
  },
});
