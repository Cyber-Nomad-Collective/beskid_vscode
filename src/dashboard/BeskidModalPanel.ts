import * as vscode from "vscode";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";
import { renderDashboardHtml } from "./dashboardHtml.js";

/** Panel webview id — must match `package.json` `views.beskidPanel`. */
export const BESKID_DASHBOARD_VIEW_ID = "beskidDashboardView";

/** Status-bar dashboard (bottom panel), not an editor tab. */
export class BeskidModalPanel implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly runtime: LspRuntimeState,
    private readonly extensionVersion: string,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        (message as { type?: string }).type === "command" &&
        "command" in message &&
        typeof (message as { command?: string }).command === "string"
      ) {
        void vscode.commands.executeCommand((message as { command: string }).command);
      }
    });
    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
    this.refresh();
  }

  async open(): Promise<void> {
    await vscode.commands.executeCommand(`${BESKID_DASHBOARD_VIEW_ID}.focus`);
    this.refresh();
  }

  refresh(): void {
    if (!this.view) {
      return;
    }
    const snapshot = this.runtime.getSnapshot();
    this.view.webview.html = renderDashboardHtml(snapshot, this.extensionVersion);
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      this.runtime.onDidChange(() => this.refresh()),
      vscode.window.registerWebviewViewProvider(BESKID_DASHBOARD_VIEW_ID, this),
      vscode.commands.registerCommand("beskid.modal.open", () => this.open()),
      vscode.commands.registerCommand("beskid.dashboard.focus", () => this.open()),
    );
  }
}
