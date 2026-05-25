import * as vscode from "vscode";
import { focusBeskidWebviewView } from "../activation/focusBeskidViews.js";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";
import { WebviewHost } from "../webviews/WebviewHost.js";
import { renderDashboardHtml } from "./dashboardHtml.js";

export class BeskidDashboardProvider extends WebviewHost implements vscode.WebviewViewProvider {
  static readonly viewType = "beskidDashboardView";

  constructor(
    private readonly runtime: LspRuntimeState,
    private readonly extensionVersion: string,
  ) {
    super();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.bindWebview(webviewView);
    this.bindCommandMessages();
    this.refresh();
  }

  refresh(): void {
    if (!this.view) {
      return;
    }
    const snapshot = this.runtime.getSnapshot();
    this.postHtml(renderDashboardHtml(snapshot, this.extensionVersion));
  }

  async focus(): Promise<void> {
    await focusBeskidWebviewView(BeskidDashboardProvider.viewType);
  }
}
