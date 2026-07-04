import { defineMcp } from "@lovable.dev/mcp-js";
import auditUrlTool from "./tools/audit-url";

export default defineMcp({
  name: "accessibility-ai-pro-mcp",
  title: "Accessibility AI Pro MCP",
  version: "0.1.0",
  instructions:
    "Tools for Accessibility AI Pro. Use `audit_url` to run a fast WCAG 2.1 AA accessibility audit against a public URL and get a JSON report of violations.",
  tools: [auditUrlTool],
});
