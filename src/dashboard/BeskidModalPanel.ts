import * as vscode from "vscode";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";
import { renderDashboardBodyHtml } from "./dashboardHtml.js";
import { modalDocumentOpen, WebviewPanelHost } from "../webviews/WebviewPanelHost.js";

const PANEL_TYPE = "beskidModal";

export class BeskidModalPanel extends WebviewPanelHost {
  constructor(
    private readonly runtime: LspRuntimeState,
    private readonly extensionVersion: string,
  ) {
    super();
  }

  open(): void {
    if (this.panel) {
      this.refresh();
      this.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PANEL_TYPE,
      "Beskid",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: false },
    );
    this.bindPanel(panel);
    this.bindCommandMessages();
    this.refresh();
  }

  refresh(): void {
    const snapshot = this.runtime.getSnapshot();
    const body = renderDashboardBodyHtml(snapshot, this.extensionVersion);
    this.postHtml(modalDocumentOpen(body, "Beskid"));
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      this.runtime.onDidChange(() => this.refresh()),
      vscode.commands.registerCommand("beskid.modal.open", () => this.open()),
      vscode.commands.registerCommand("beskid.dashboard.focus", () => this.open()),
    );
  }
}
