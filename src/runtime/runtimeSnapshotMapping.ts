import type { BeskidStatusSnapshot } from "../status/beskidStatusPresentation.js";
import type { LspRuntimePhase, LspRuntimeSnapshot } from "./lspRuntimeTypes.js";

const RUNNING_PHASES: LspRuntimePhase[] = ["running", "scanning"];

export function isLspClientRunningPhase(phase: LspRuntimePhase): boolean {
  return RUNNING_PHASES.includes(phase);
}

export function toBeskidStatusSnapshot(runtime: LspRuntimeSnapshot): BeskidStatusSnapshot {
  const clientRunning = isLspClientRunningPhase(runtime.phase);
  const startedOnce = runtime.phase !== "idle";
  return {
    lspScan: runtime.scan,
    pckgActive: runtime.pckgActivity?.active ?? false,
    pckgPhase: runtime.pckgActivity?.phase,
    pckgMessage: runtime.pckgActivity?.message,
    lspClientRunning: clientRunning,
    lspStartedOnce: startedOnce,
    runtimePhase: runtime.phase,
    runtimeDetail: runtime.detail,
  };
}
