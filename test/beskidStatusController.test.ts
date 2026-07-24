import { describe, expect, test } from "bun:test";
import type { BeskidActivityPhase } from "../src/packages/pckgActivity.js";
import type { LspRuntimeState } from "../src/runtime/LspRuntimeState.js";
import {
	applyWorkspaceScanNotification,
	phaseAfterSetClientRunning,
} from "../src/runtime/lspRuntimeTransitions.js";
import type { LspRuntimeSnapshot } from "../src/runtime/lspRuntimeTypes.js";
import { BeskidStatusController } from "../src/status/beskidStatusController.js";
import type { BeskidStatusParams } from "../src/status/beskidStatusTypes.js";
import { testRuntimeSnapshot } from "./fixtures/lspRuntimeSnapshot.js";

function mockStatusBar(): { text: string; tooltip: string } {
	return { text: "", tooltip: "" };
}

function createMockRuntime(
	initial: Partial<LspRuntimeSnapshot> = {},
): LspRuntimeState {
	let snapshot = testRuntimeSnapshot(initial);
	let listener: ((s: LspRuntimeSnapshot) => void) | undefined;

	const publish = () => listener?.(snapshot);

	return {
		onDidChange: (handler: (s: LspRuntimeSnapshot) => void) => {
			listener = handler;
			handler(snapshot);
			return { dispose: () => {} };
		},
		getSnapshot: () => snapshot,
		applyLspNotification: (params: BeskidStatusParams) => {
			const outcome = applyWorkspaceScanNotification(
				snapshot.phase,
				snapshot.scan,
				params,
			);
			if (outcome) {
				snapshot = {
					...snapshot,
					phase: outcome.phase,
					scan: outcome.scan,
					lastStatusNotification: params,
				};
			} else {
				snapshot = { ...snapshot, lastStatusNotification: params };
			}
			publish();
		},
		setClientRunning: (running: boolean) => {
			const next = phaseAfterSetClientRunning(snapshot.phase, running, true);
			if (next) {
				snapshot = { ...snapshot, phase: next };
			}
			publish();
		},
		setPckgActivity: (
			phase: BeskidActivityPhase,
			active: boolean,
			detail?: string,
		) => {
			if (active) {
				snapshot = {
					...snapshot,
					pckgActivity: { phase, active: true, message: detail },
				};
			} else if (snapshot.pckgActivity?.phase === phase) {
				snapshot = { ...snapshot, pckgActivity: undefined };
			}
			publish();
		},
	} as unknown as LspRuntimeState;
}

describe("BeskidStatusController", () => {
	test("applyLspNotification updates scan then clears on inactive", () => {
		const bar = mockStatusBar();
		const runtime = createMockRuntime({ phase: "running" });
		new BeskidStatusController(bar as never, runtime);
		runtime.applyLspNotification({
			source: "lsp",
			phase: "workspace_scan",
			active: true,
			current: 1,
			total: 4,
			message: "walk",
		});
		expect(bar.text).toContain("Scan");
		expect(bar.text).toContain("1/4");
		runtime.applyLspNotification({
			source: "lsp",
			phase: "workspace_scan",
			active: false,
		});
		expect(bar.text).toBe("$(zap) Beskid LSP: Running");
	});

	test("ignores notifications from non-lsp sources", () => {
		const bar = mockStatusBar();
		const runtime = createMockRuntime({ phase: "running" });
		new BeskidStatusController(bar as never, runtime);
		runtime.applyLspNotification({
			source: "cli",
			phase: "workspace_scan",
			active: true,
			current: 9,
			total: 9,
		});
		expect(bar.text).toBe("$(zap) Beskid LSP: Running");
	});

	test("setClientRunning transitions idle → running → stopped", () => {
		const bar = mockStatusBar();
		const runtime = createMockRuntime({ phase: "idle" });
		new BeskidStatusController(bar as never, runtime);
		runtime.setClientRunning(true);
		expect(bar.text).toContain("Running");
		runtime.setClientRunning(false);
		expect(bar.text).toContain("Stopped");
	});

	test("setPckgActivity clears only matching phase", () => {
		const bar = mockStatusBar();
		const runtime = createMockRuntime({ phase: "running" });
		new BeskidStatusController(bar as never, runtime);
		runtime.setPckgActivity("search", true, "query=core");
		expect(bar.text).toContain("query=core");
		runtime.setPckgActivity("details", false);
		expect(bar.text).toContain("query=core");
		runtime.setPckgActivity("search", false);
		expect(bar.text).toBe("$(zap) Beskid LSP: Running");
	});
});
