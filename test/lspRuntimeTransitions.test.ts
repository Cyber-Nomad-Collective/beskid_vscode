import { describe, expect, test } from "bun:test";
import {
	applyWorkspaceScanNotification,
	phaseAfterSetClientRunning,
} from "../src/runtime/lspRuntimeTransitions.js";

describe("applyWorkspaceScanNotification", () => {
	test("ignores non-lsp sources", () => {
		const outcome = applyWorkspaceScanNotification(
			"running",
			{ active: false },
			{
				source: "cli",
				phase: "workspace_scan",
				active: true,
				current: 1,
				total: 1,
			},
		);
		expect(outcome).toBeUndefined();
	});

	test("active scan enters scanning phase", () => {
		const outcome = applyWorkspaceScanNotification(
			"running",
			{ active: false },
			{
				source: "lsp",
				phase: "workspace_scan",
				active: true,
				current: 2,
				total: 5,
			},
		);
		expect(outcome?.phase).toBe("scanning");
		expect(outcome?.scan.active).toBe(true);
		expect(outcome?.scan.current).toBe(2);
	});

	test("inactive scan from scanning returns to running", () => {
		const outcome = applyWorkspaceScanNotification(
			"scanning",
			{ active: true, current: 5, total: 5 },
			{ source: "lsp", phase: "workspace_scan", active: false },
		);
		expect(outcome?.phase).toBe("running");
		expect(outcome?.scan.active).toBe(false);
	});
});

describe("phaseAfterSetClientRunning", () => {
	test("start moves idle to running", () => {
		expect(phaseAfterSetClientRunning("idle", true, false)).toBe("running");
	});

	test("stop after start yields stopped unless bootstrapping", () => {
		expect(phaseAfterSetClientRunning("running", false, true)).toBe("stopped");
		expect(
			phaseAfterSetClientRunning("bootstrapping", false, true),
		).toBeUndefined();
	});

	test("does not clobber scanning or error on start", () => {
		expect(phaseAfterSetClientRunning("scanning", true, true)).toBeUndefined();
		expect(phaseAfterSetClientRunning("error", true, true)).toBeUndefined();
	});
});
