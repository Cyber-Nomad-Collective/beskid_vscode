import { describe, expect, test } from "bun:test";
import {
	launchDebugRows,
	runtimeDebugRows,
} from "../src/debug/debugTreeShape.js";
import { testRuntimeSnapshot } from "./fixtures/lspRuntimeSnapshot.js";

describe("debugTreeShape", () => {
	test("runtimeDebugRows formats active scan progress", () => {
		const rows = runtimeDebugRows(
			testRuntimeSnapshot({
				phase: "scanning",
				workspaceRoots: ["/repo"],
				scan: { active: true, current: 2, total: 10, message: "walk" },
				pckgActivity: { phase: "fetch", active: true, message: "corelib" },
			}),
		);
		const scan = rows.find((r) => r.label === "Scan");
		expect(scan?.value).toContain("2/10");
		expect(scan?.value).toContain("walk");
		const pkg = rows.find((r) => r.label === "Package activity");
		expect(pkg?.value).toContain("fetch");
		expect(pkg?.value).toContain("corelib");
	});

	test("launchDebugRows reports unresolved launch", () => {
		expect(launchDebugRows(testRuntimeSnapshot())).toEqual([
			{ label: "Launch", value: "not resolved yet" },
		]);
	});

	test("launchDebugRows includes command line details", () => {
		const rows = launchDebugRows(
			testRuntimeSnapshot({
				workspaceRoots: ["/repo"],
				launch: {
					source: "cli",
					command: "/bin/beskid",
					args: ["lsp"],
					cwd: "/repo",
					binaryPath: "/bin/beskid",
				},
			}),
		);
		expect(rows.find((r) => r.label === "Source")?.value).toBe("cli");
		expect(rows.find((r) => r.label === "Args")?.value).toBe("lsp");
	});
});
