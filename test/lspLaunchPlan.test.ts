import { describe, expect, test } from "bun:test";
import { planLspLaunch } from "../src/lsp/lspLaunchPlan.js";

describe("planLspLaunch", () => {
	test("runs the explicit server even in dev mode", () => {
		expect(planLspLaunch({ source: "explicit", serverPath: "/x/beskid_lsp" }, true)).toEqual({
			kind: "binary",
			serverPath: "/x/beskid_lsp",
		});
	});

	test("runs the bundled or managed server outside dev mode", () => {
		expect(planLspLaunch({ source: "bundled", serverPath: "/e/beskid_lsp" }, false)).toEqual({
			kind: "binary",
			serverPath: "/e/beskid_lsp",
		});
		expect(planLspLaunch({ source: "managed", serverPath: "/m/beskid_lsp" }, false).kind).toBe("binary");
	});

	test("dev mode overrides the bundled server", () => {
		expect(planLspLaunch({ source: "bundled", serverPath: "/e/beskid_lsp" }, true)).toEqual({ kind: "dev" });
	});

	test("without a selected server and dev mode nothing starts (no workspace compiler build)", () => {
		expect(planLspLaunch({ source: "none" }, false)).toEqual({ kind: "none" });
	});
});
