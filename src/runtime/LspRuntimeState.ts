import * as vscode from "vscode";
import type { BeskidStatusParams } from "../status/beskidStatusTypes.js";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";
import {
  type LspLaunchSnapshot,
  type LspRuntimePhase,
  type LspRuntimeSnapshot,
  type LspScanSnapshot,
  type LspSettingsFlags,
  type PckgActivitySnapshot,
} from "./lspRuntimeTypes.js";
import {
  applyWorkspaceScanNotification,
  phaseAfterSetClientRunning,
} from "./lspRuntimeTransitions.js";

function readSettingsFlags(): LspSettingsFlags {
  const beskid = vscode.workspace.getConfiguration("beskid");
  const lsp = vscode.workspace.getConfiguration("beskid.lsp");
  return {
    devMode: lsp.get<boolean>("server.devMode", false),
    preferBundled: lsp.get<boolean>("server.preferBundled", false),
    explicitServerPath: lsp.get<string>("server.path", "").trim(),
    lspReleaseTag: lsp.get<string>("releaseTag", "lsp-latest"),
    configuredCliPath: beskid.get<string>("cli.path", "beskid"),
    cliReleaseTag: beskid.get<string>("cli.releaseTag", "cli-latest"),
    autoFetchDependencies: beskid.get<boolean>("toolchain.autoFetchDependencies", true),
    autoSelectFromEditor: beskid.get<boolean>("project.autoSelectFromEditor", true),
    logLevel: lsp.get<string>("log.level", "info"),
    logServerOutput: lsp.get<boolean>("log.serverOutput", true),
    pckgBaseUrl: beskid.get<string>("pckg.baseUrl", "http://localhost:5000"),
  };
}

function workspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
}

export class LspRuntimeState {
  private phase: LspRuntimePhase = "idle";
  private detail: string | undefined;
  private launch: LspLaunchSnapshot | undefined;
  private cliVersion: string | undefined;
  private lspVersion: string | undefined;
  private focusedProjectUri: string | undefined;
  private scan: LspScanSnapshot = { active: false };
  private lastStatusNotification: BeskidStatusParams | undefined;
  private error: string | undefined;
  private pckgActivity: PckgActivitySnapshot | undefined;
  private clientStartedOnce = false;

  private readonly emitter = new vscode.EventEmitter<LspRuntimeSnapshot>();

  readonly onDidChange = this.emitter.event;

  dispose(): void {
    this.emitter.dispose();
  }

  getSnapshot(): LspRuntimeSnapshot {
    return {
      phase: this.phase,
      detail: this.detail,
      launch: this.launch,
      cliVersion: this.cliVersion,
      lspVersion: this.lspVersion,
      focusedProjectUri: this.focusedProjectUri,
      scan: { ...this.scan },
      lastStatusNotification: this.lastStatusNotification,
      error: this.error,
      pckgActivity: this.pckgActivity ? { ...this.pckgActivity } : undefined,
      workspaceRoots: workspaceRoots(),
      settingsFlags: readSettingsFlags(),
    };
  }

  setPhase(phase: LspRuntimePhase, detail?: string): void {
    this.phase = phase;
    this.detail = detail;
    if (phase !== "error") {
      this.error = undefined;
    }
    this.publish();
  }

  setError(message: string | undefined): void {
    this.error = message;
    if (message) {
      this.phase = "error";
      this.detail = message;
    }
    this.publish();
  }

  setLaunch(launch: LspLaunchSnapshot): void {
    this.launch = launch;
    this.publish();
  }

  setVersions(cliVersion?: string, lspVersion?: string): void {
    if (cliVersion !== undefined) {
      this.cliVersion = cliVersion;
    }
    if (lspVersion !== undefined) {
      this.lspVersion = lspVersion;
    }
    this.publish();
  }

  setFocusedProject(uri: vscode.Uri | undefined): void {
    this.focusedProjectUri = uri?.toString();
    this.publish();
  }

  setClientRunning(running: boolean): void {
    if (running) {
      this.clientStartedOnce = true;
    }
    const next = phaseAfterSetClientRunning(this.phase, running, this.clientStartedOnce);
    if (next) {
      this.phase = next;
      this.detail = undefined;
    }
    if (!running && this.clientStartedOnce) {
      this.scan = { active: false };
    }
    this.publish();
  }

  applyLspNotification(params: BeskidStatusParams): void {
    this.lastStatusNotification = params;
    const outcome = applyWorkspaceScanNotification(this.phase, this.scan, params);
    if (outcome) {
      this.phase = outcome.phase;
      this.scan = outcome.scan;
      if (outcome.phase === "running") {
        this.detail = undefined;
      }
    }
    this.publish();
  }

  setPckgActivity(phase: BeskidActivityPhase, active: boolean, detail?: string): void {
    if (active) {
      this.pckgActivity = { phase, active: true, message: detail };
    } else if (this.pckgActivity?.phase === phase) {
      this.pckgActivity = undefined;
    }
    this.publish();
  }

  refreshSettings(): void {
    this.publish();
  }

  private publish(): void {
    this.emitter.fire(this.getSnapshot());
  }
}
