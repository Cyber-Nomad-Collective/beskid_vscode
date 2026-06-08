/**
 * Templates webview deferred to a future release.
 *
 * v0.4 tracks scaffold intent only — no WebviewViewProvider is registered until
 * pckg template search/install APIs are wired from LSP/CLI. See task
 * `vscode-pckg-docs-integration` in beskid_tracker v0.4 seed.
 */
export const TEMPLATES_PANEL_VIEW_TYPE = "beskidTemplatesView";

export type TemplatesPanelMessage =
  | { type: "search"; query: string }
  | { type: "install"; templateId: string; projectUri?: string };

export type TemplatesSearchResult = {
  id: string;
  name: string;
  description?: string;
};
