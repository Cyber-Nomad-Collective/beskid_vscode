import type { BeskidStatusParams } from "../status/beskidStatusTypes.js";
import type { LspRuntimePhase, LspScanSnapshot } from "./lspRuntimeTypes.js";

export type ScanNotificationOutcome = {
	phase: LspRuntimePhase;
	scan: LspScanSnapshot;
};

/** Pure workspace-scan handling shared by {@link LspRuntimeState}. */
export function applyWorkspaceScanNotification(
	currentPhase: LspRuntimePhase,
	_scan: LspScanSnapshot,
	params: BeskidStatusParams,
): ScanNotificationOutcome | undefined {
	if (params.source !== "lsp") {
		return undefined;
	}
	if (params.phase === "workspace_scan") {
		const nextScan: LspScanSnapshot = {
			active: params.active,
			message: params.message,
			current: params.current,
			total: params.total,
		};
		if (params.active) {
			return { phase: "scanning", scan: nextScan };
		}
		if (currentPhase === "scanning") {
			return { phase: "running", scan: { active: false } };
		}
		return { phase: currentPhase, scan: nextScan };
	}
	if (!params.active && currentPhase === "scanning") {
		return { phase: "running", scan: { active: false } };
	}
	return undefined;
}

export function phaseAfterSetClientRunning(
	currentPhase: LspRuntimePhase,
	running: boolean,
	clientStartedOnce: boolean,
): LspRuntimePhase | undefined {
	if (running) {
		if (currentPhase !== "scanning" && currentPhase !== "error") {
			return "running";
		}
		return undefined;
	}
	if (!clientStartedOnce) {
		return undefined;
	}
	if (
		currentPhase !== "error" &&
		currentPhase !== "downloading" &&
		currentPhase !== "bootstrapping"
	) {
		return "stopped";
	}
	return undefined;
}
