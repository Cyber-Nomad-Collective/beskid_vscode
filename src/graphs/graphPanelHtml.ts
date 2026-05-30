import { escapeHtml } from "../webviews/webviewHtml.js";
import type { GraphNodeSummary } from "./lspGraphTypes.js";

export interface GraphPanelViewState {
  title: string;
  mermaid: string;
  revision: string;
  kind: string;
  warnings: Array<{ code: string; message: string }>;
  nodes: GraphNodeSummary[];
}

export function renderGraphPanelHtml(
  cspSource: string,
  mermaidScriptUri: string,
  panelScriptUri: string,
  state: GraphPanelViewState,
): string {
  const payload = JSON.stringify(state).replaceAll("<", "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource};" />
  <style>
    html, body { height: 100%; margin: 0; overflow: hidden; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    header select, header button {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 4px 8px;
    }
    #warnings {
      padding: 6px 12px;
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-inputValidation-warningForeground);
      font-size: 12px;
    }
    #viewport {
      flex: 1;
      overflow: hidden;
      position: relative;
      cursor: grab;
    }
    #viewport:active { cursor: grabbing; }
    #diagram {
      transform-origin: 0 0;
      padding: 24px;
      min-width: 100%;
      min-height: 100%;
    }
    .revision { opacity: 0.65; font-size: 11px; margin-left: auto; }
  </style>
</head>
<body>
  <header>
    <strong>${escapeHtml(state.title)}</strong>
    <select id="kind" aria-label="Graph kind">
      <option value="projectDeps">Project deps</option>
      <option value="workspace">Workspace</option>
      <option value="moduleTree">Module tree</option>
      <option value="importClosure">Import closure</option>
      <option value="hostComposition">Host / DI</option>
    </select>
    <button id="refresh" type="button">Refresh</button>
    <span class="revision">rev ${escapeHtml(state.revision.slice(0, 12))}</span>
  </header>
  <div id="warnings" hidden></div>
  <div id="viewport"><div id="diagram"></div></div>
  <script>window.__GRAPH_STATE__ = ${payload};</script>
  <script src="${mermaidScriptUri}"></script>
  <script src="${panelScriptUri}"></script>
</body>
</html>`;
}
