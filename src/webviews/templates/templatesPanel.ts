import * as vscode from "vscode";

/** Future panel id for package template search/install UI. Not registered yet. */
export const TEMPLATES_PANEL_VIEW_TYPE = "beskidTemplatesView";

/**
 * Scaffold for a future templates webview (search, install, manifest preview).
 * TODO: register WebviewViewProvider when pckg template APIs are wired from LSP/CLI.
 */
export type TemplatesPanelMessage =
  | { type: "search"; query: string }
  | { type: "install"; templateId: string; projectUri?: string };

export type TemplatesPanelState = {
  query: string;
  results: TemplatesSearchResult[];
};

export type TemplatesSearchResult = {
  id: string;
  name: string;
  description?: string;
};

export class TemplatesPanelProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(
    _webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    // TODO: implement when templates UX is in scope
  }
}
