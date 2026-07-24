import { describe, expect, test } from "bun:test";
import { deriveBeskidStatusPresentation } from "../src/status/beskidStatusPresentation.js";

describe("deriveBeskidStatusPresentation", () => {
	const idle = {
		lspScan: { active: false },
		pckgActive: false,
		lspClientRunning: false,
		lspStartedOnce: false,
	};

	test("idle before first start shows neutral LSP label", () => {
		const { text } = deriveBeskidStatusPresentation(idle);
		expect(text).toBe("$(zap) Beskid LSP");
	});

	test("running client without activity shows Running", () => {
		const { text } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
		});
		expect(text).toBe("$(zap) Beskid LSP: Running");
	});

	test("stopped after start shows Stopped", () => {
		const { text } = deriveBeskidStatusPresentation({
			...idle,
			lspStartedOnce: true,
		});
		expect(text).toBe("$(debug-stop) Beskid LSP: Stopped");
	});

	test("workspace scan shows progress count and message", () => {
		const { text, tooltipLines } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
			lspScan: { active: true, current: 2, total: 5, message: "indexing" },
		});
		expect(text).toContain("$(sync~spin) Scan");
		expect(text).toContain("2/5");
		expect(text).toContain("indexing");
		expect(tooltipLines.some((l) => l.includes("2/5"))).toBe(true);
	});

	test("scan takes priority over package activity", () => {
		const { text } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
			lspScan: { active: true, current: 1, total: 3 },
			pckgActive: true,
			pckgPhase: "search",
		});
		expect(text).toContain("Scan");
		expect(text).not.toContain("Searching packages");
	});

	test("package search activity when scan inactive", () => {
		const { text } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
			pckgActive: true,
			pckgPhase: "search",
		});
		expect(text).toContain("Searching packages");
	});

	test("custom package detail overrides default phase label", () => {
		const { text, tooltipLines } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
			pckgActive: true,
			pckgPhase: "fetch",
			pckgMessage: "corelib@1.2.3",
		});
		expect(text).toContain("corelib@1.2.3");
		expect(tooltipLines).toContain("corelib@1.2.3");
	});

	test("running client combines LSP and activity segments", () => {
		const { text } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
			pckgActive: true,
			pckgPhase: "build",
		});
		expect(text).toBe("$(zap) Beskid: $(package) Running build…");
	});

	test("ignores non-lsp notification phases via controller contract", () => {
		const { text } = deriveBeskidStatusPresentation({
			...idle,
			lspScan: { active: false },
			lspClientRunning: true,
		});
		expect(text).toBe("$(zap) Beskid LSP: Running");
	});

	test("shows pckg connection health when idle", () => {
		const { text, tooltipLines } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
			pckgConnection: {
				connected: true,
				label: "Connected · https://pckg.beskid-lang.org · public catalog",
			},
		});
		expect(text).toContain("$(check) pckg");
		expect(
			tooltipLines.some((line) => line.includes("pckg.beskid-lang.org")),
		).toBe(true);
	});

	test("shows warning icon when registry is unreachable", () => {
		const { text } = deriveBeskidStatusPresentation({
			...idle,
			lspClientRunning: true,
			pckgConnection: {
				connected: false,
				label: "https://pckg.beskid-lang.org · timeout",
			},
		});
		expect(text).toContain("$(warning) pckg");
	});
});
