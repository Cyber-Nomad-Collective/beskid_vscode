import { describe, expect, test } from "bun:test";
import { renderDashboardHtml } from "../src/dashboard/dashboardHtml.js";
import { testRuntimeSnapshot } from "./fixtures/lspRuntimeSnapshot.js";

describe("renderDashboardHtml", () => {
  test("escapes error HTML and shows phase badge", () => {
    const html = renderDashboardHtml(
      testRuntimeSnapshot({ phase: "error", error: "<script>alert(1)</script>" }),
      "0.1.0",
    );
    expect(html).toContain("badge--error");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("scanning badge overrides idle running phase", () => {
    const html = renderDashboardHtml(
      testRuntimeSnapshot({
        phase: "running",
        scan: { active: true, current: 1, total: 3, message: "index" },
      }),
      "0.1.0",
    );
    expect(html).toContain("badge--scanning");
    expect(html).toContain("1 / 3");
    expect(html).toContain("index");
  });

  test("posts quick-action commands for dashboard buttons", () => {
    const html = renderDashboardHtml(testRuntimeSnapshot(), "0.1.0");
    expect(html).toContain('data-command="beskid.lsp.restart"');
    expect(html).toContain("postMessage");
    expect(html).toContain("type: 'command'");
  });
});
