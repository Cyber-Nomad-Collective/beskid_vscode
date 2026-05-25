import type { BeskidActivityPhase } from "../packages/pckgActivity.js";
import type { LspRuntimePhase, LspScanSnapshot } from "../runtime/lspRuntimeTypes.js";

export type BeskidStatusSnapshot = {
  lspScan: LspScanSnapshot;
  pckgActive: boolean;
  pckgPhase?: BeskidActivityPhase;
  pckgMessage?: string;
  lspClientRunning: boolean;
  lspStartedOnce: boolean;
  runtimePhase?: LspRuntimePhase;
  runtimeDetail?: string;
};

const RUNTIME_PHASE_LABEL: Partial<Record<LspRuntimePhase, string>> = {
  bootstrapping: "Setting up toolchain…",
  downloading: "Downloading…",
  starting: "Starting…",
  error: "Error",
  stopped: "Stopped",
  idle: "Beskid LSP",
};

const PCKG_PHASE_LABELS: Record<BeskidActivityPhase, string> = {
  search: "Searching packages…",
  details: "Loading package details…",
  fetch: "Running fetch…",
  lock: "Running lock…",
  build: "Running build…",
  test: "Running test…",
  analyze: "Running analyze…",
};

function formatScanPart(scan: LspScanSnapshot): string {
  const count =
    scan.current !== undefined && scan.total !== undefined
      ? `${scan.current}/${scan.total}`
      : "";
  const tail = [count, scan.message].filter(Boolean).join(" ");
  return `$(sync~spin) Scan${tail ? ` ${tail}` : ""}`;
}

function formatPckgPart(phase: BeskidActivityPhase, message?: string): string {
  const label = message ?? PCKG_PHASE_LABELS[phase] ?? "Packages…";
  return `$(package) ${label}`;
}

function activityParts(snapshot: BeskidStatusSnapshot): string[] {
  const parts: string[] = [];
  if (snapshot.lspScan.active) {
    parts.push(formatScanPart(snapshot.lspScan));
  } else if (snapshot.pckgActive && snapshot.pckgPhase) {
    parts.push(formatPckgPart(snapshot.pckgPhase, snapshot.pckgMessage));
  }
  return parts;
}

/** Pure status-bar text and tooltip lines from extension/LSP activity snapshot. */
export function deriveBeskidStatusPresentation(snapshot: BeskidStatusSnapshot): {
  text: string;
  tooltipLines: string[];
} {
  const parts = activityParts(snapshot);
  const joined = parts.join(" · ");

  const transitional =
    snapshot.runtimePhase &&
    !snapshot.lspClientRunning &&
    snapshot.runtimePhase !== "stopped" &&
    snapshot.runtimePhase !== "idle";

  let text: string;
  if (snapshot.lspClientRunning) {
    text = parts.length > 0 ? `$(zap) Beskid: ${joined}` : "$(zap) Beskid LSP: Running";
  } else if (transitional && snapshot.runtimePhase) {
    const label = RUNTIME_PHASE_LABEL[snapshot.runtimePhase] ?? snapshot.runtimePhase;
    const icon =
      snapshot.runtimePhase === "error"
        ? "$(error)"
        : snapshot.runtimePhase === "downloading"
          ? "$(cloud-download)"
          : "$(sync~spin)";
    text = parts.length > 0 ? `${icon} Beskid: ${joined}` : `${icon} Beskid LSP: ${label}`;
  } else if (!snapshot.lspStartedOnce) {
    text = parts.length > 0 ? `$(zap) Beskid: ${joined}` : "$(zap) Beskid LSP";
  } else {
    text =
      parts.length > 0
        ? `$(debug-stop) Beskid: ${joined}`
        : "$(debug-stop) Beskid LSP: Stopped";
  }

  const tooltipLines = ["Beskid LSP quick actions (click)"];
  if (snapshot.lspScan.active) {
    tooltipLines.push(
      `Workspace scan: ${snapshot.lspScan.current ?? "?"}/${snapshot.lspScan.total ?? "?"}`,
    );
  }
  if (snapshot.pckgActive) {
    tooltipLines.push(snapshot.pckgMessage ?? "Package / CLI activity");
  }

  return { text, tooltipLines };
}
