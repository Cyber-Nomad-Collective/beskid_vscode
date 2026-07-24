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
		expect(html).toContain('data-command="beskid.lsp.openLogs"');
		expect(html).toContain('data-command="beskid.refreshWorkspace"');
		expect(html).toContain("postMessage");
		expect(html).toContain("type: 'command'");
	});

	test("uses panel background styling instead of editor-tab modal scrim", () => {
		const html = renderDashboardHtml(testRuntimeSnapshot(), "0.1.0");
		expect(html).toContain("background: var(--vscode-sideBar-background)");
		expect(html).not.toContain('class="scrim"');
		expect(html).not.toContain("modalShellStyles");
	});

	test("renders workspace and launch metadata", () => {
		const html = renderDashboardHtml(
			testRuntimeSnapshot({
				focusedProjectUri: "file:///tmp/demo/demo.bproj",
				launch: {
					command: "/usr/local/bin/beskid_lsp",
					args: ["lsp"],
					binaryPath: "/usr/local/bin/beskid_lsp",
					source: "explicit",
				},
				settingsFlags: {
					...testRuntimeSnapshot().settingsFlags,
					pckgBaseUrl: "https://pckg.example.test",
				},
			}),
			"0.2.5",
		);
		expect(html).toContain("Focused project");
		expect(html).toContain("/tmp/demo/demo.bproj");
		expect(html).toContain("https://pckg.example.test");
		expect(html).toContain("/usr/local/bin/beskid_lsp");
		expect(html).toContain("explicit");
		expect(html).toContain("0.2.5");
	});
});
