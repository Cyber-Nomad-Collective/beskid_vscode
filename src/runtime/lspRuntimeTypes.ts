import type { BeskidStatusParams } from "../status/beskidStatusTypes.js";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";

/** Canonical LSP lifecycle phase for status bar, dashboard, and debug views. */
export type LspRuntimePhase =
  | "idle"
  | "bootstrapping"
  | "downloading"
  | "starting"
  | "running"
  | "scanning"
  | "error"
  | "stopped";

export type LspLaunchSource =
  | "explicit"
  | "cli"
  | "bundled"
  | "compiler-release"
  | "dev-cargo";

export type LspLaunchSnapshot = {
  command: string;
  args: string[];
  cwd?: string;
  source: LspLaunchSource;
  binaryPath: string;
};

export type LspScanSnapshot = {
  active: boolean;
  message?: string;
  current?: number;
  total?: number;
};

export type PckgActivitySnapshot = {
  phase: BeskidActivityPhase;
  active: boolean;
  message?: string;
};

export type PckgConnectionSnapshot = {
  connected: boolean;
  label: string;
};

/** Read-only snapshot consumed by dashboard, debug tree, and status bar. */
export type LspRuntimeSnapshot = {
  phase: LspRuntimePhase;
  detail?: string;
  launch?: LspLaunchSnapshot;
  cliVersion?: string;
  lspVersion?: string;
  focusedProjectUri?: string;
  scan: LspScanSnapshot;
  lastStatusNotification?: BeskidStatusParams;
  error?: string;
  pckgActivity?: PckgActivitySnapshot;
  pckgConnection?: PckgConnectionSnapshot;
  workspaceRoots: string[];
  settingsFlags: LspSettingsFlags;
};

export type LspSettingsFlags = {
  devMode: boolean;
  preferBundled: boolean;
  explicitServerPath: string;
  lspReleaseTag: string;
  configuredCliPath: string;
  cliReleaseTag: string;
  autoFetchDependencies: boolean;
  autoInstallOnLaunch: boolean;
  autoSelectFromEditor: boolean;
  logLevel: string;
  logServerOutput: boolean;
  pckgBaseUrl: string;
};
