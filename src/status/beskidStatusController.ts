import * as vscode from "vscode";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";
import type { BeskidStatusParams } from "./beskidStatusTypes.js";

type LspScanState = {
  active: boolean;
  message?: string;
  current?: number;
  total?: number;
};

export class BeskidStatusController {
  private lspScan: LspScanState = { active: false };
  private pckgPhase: BeskidActivityPhase | undefined;
  private pckgActive = false;
  private pckgMessage: string | undefined;
  private lspClientRunning = false;
  /** After the first successful start, show "Stopped" when the client is not running. */
  private lspStartedOnce = false;

  constructor(private readonly statusBar: vscode.StatusBarItem) {}

  setLspClientRunning(running: boolean): void {
    this.lspClientRunning = running;
    if (running) {
      this.lspStartedOnce = true;
    }
    this.render();
  }

  applyLspNotification(params: BeskidStatusParams): void {
    if (params.source !== "lsp") {
      return;
    }
    if (params.phase === "workspace_scan") {
      this.lspScan = {
        active: params.active,
        message: params.message,
        current: params.current,
        total: params.total,
      };
    } else if (!params.active) {
      this.lspScan = { active: false };
    }
    this.render();
  }

  setPckgActivity(phase: BeskidActivityPhase, active: boolean, detail?: string): void {
    if (active) {
      this.pckgPhase = phase;
      this.pckgActive = true;
      if (detail) {
        this.pckgMessage = detail;
      }
    } else if (this.pckgPhase === phase) {
      this.pckgActive = false;
      this.pckgPhase = undefined;
    }
    this.render();
  }

  /** @deprecated Use setPckgActivity */
  setPckgSearchActive(active: boolean, detail?: string): void {
    this.setPckgActivity("search", active, detail);
  }

  /** @deprecated Use setPckgActivity */
  setPckgDetailsActive(active: boolean, detail?: string): void {
    this.setPckgActivity("details", active, detail);
  }

  private render(): void {
    const parts: string[] = [];

    if (this.lspScan.active) {
      const count =
        this.lspScan.current !== undefined && this.lspScan.total !== undefined
          ? `${this.lspScan.current}/${this.lspScan.total}`
          : "";
      const tail = [count, this.lspScan.message].filter(Boolean).join(" ");
      parts.push(`$(sync~spin) Scan${tail ? ` ${tail}` : ""}`);
    } else if (this.pckgActive && this.pckgPhase) {
      const label =
        this.pckgMessage ??
        ({
          search: "Searching packages…",
          details: "Loading package details…",
          fetch: "Running fetch…",
          lock: "Running lock…",
          build: "Running build…",
          test: "Running test…",
          analyze: "Running analyze…",
        }[this.pckgPhase] ?? "Packages…");
      parts.push(`$(package) ${label}`);
    }

    if (this.lspClientRunning) {
      this.statusBar.text =
        parts.length > 0 ? `$(zap) Beskid: ${parts.join(" · ")}` : "$(zap) Beskid LSP: Running";
    } else if (!this.lspStartedOnce) {
      this.statusBar.text =
        parts.length > 0 ? `$(zap) Beskid: ${parts.join(" · ")}` : "$(zap) Beskid LSP";
    } else {
      this.statusBar.text =
        parts.length > 0
          ? `$(debug-stop) Beskid: ${parts.join(" · ")}`
          : "$(debug-stop) Beskid LSP: Stopped";
    }

    const tooltipLines = ["Beskid LSP quick actions (click)"];
    if (this.lspScan.active) {
      tooltipLines.push(`Workspace scan: ${this.lspScan.current ?? "?"}/${this.lspScan.total ?? "?"}`);
    }
    if (this.pckgActive) {
      tooltipLines.push(this.pckgMessage ?? "Package / CLI activity");
    }
    this.statusBar.tooltip = tooltipLines.join("\n");
  }
}
