import type { LspRuntimeSnapshot } from "../runtime/lspRuntimeTypes.js";
import { escapeHtml, WEBVIEW_CSP_META } from "../webviews/webviewHtml.js";

const DASHBOARD_STYLES = `
    h2 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
      margin: 16px 0 8px;
    }
    h2:first-of-type { margin-top: 0; }
    .card {
      border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
      background: var(--vscode-editor-background);
    }
    .row { display: flex; gap: 8px; margin: 4px 0; font-size: 12px; }
    .label { flex: 0 0 38%; color: var(--vscode-descriptionForeground); }
    .value { flex: 1; word-break: break-all; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    button {
      font-family: inherit;
      font-size: 12px;
      padding: 4px 10px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
    }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button:hover { opacity: 0.9; }
    .hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
    }
`;

function row(label: string, value: string | undefined): string {
  const display = value?.trim() ? escapeHtml(value) : "—";
  return `<div class="row"><span class="label">${escapeHtml(label)}</span><span class="value">${display}</span></div>`;
}

function phaseBadge(snapshot: LspRuntimeSnapshot): string {
  const phase = snapshot.scan.active ? "scanning" : snapshot.phase;
  return `<span class="badge badge--${escapeHtml(phase)}">${escapeHtml(phase)}</span>`;
}

export function renderDashboardBodyHtml(
  snapshot: LspRuntimeSnapshot,
  extensionVersion: string,
): string {
  const launch = snapshot.launch;
  const launchLine = launch
    ? `${launch.command} ${launch.args.join(" ")}`.trim()
    : undefined;
  const scanLine =
    snapshot.scan.active && snapshot.scan.total !== undefined
      ? `${snapshot.scan.current ?? 0} / ${snapshot.scan.total}${snapshot.scan.message ? ` — ${snapshot.scan.message}` : ""}`
      : snapshot.scan.message;

  const focused = snapshot.focusedProjectUri
    ? snapshot.focusedProjectUri.replace(/^file:\/\//, "")
    : undefined;

  return `<style>${DASHBOARD_STYLES}</style>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <strong>Language server</strong>
      ${phaseBadge(snapshot)}
    </div>
    ${snapshot.detail ? `<p class="hint">${escapeHtml(snapshot.detail)}</p>` : ""}
    ${snapshot.error ? `<p class="hint" style="color:var(--vscode-errorForeground)">${escapeHtml(snapshot.error)}</p>` : ""}
    ${row("CLI version", snapshot.cliVersion)}
    ${row("LSP version", snapshot.lspVersion)}
    ${row("Binary", launch?.binaryPath)}
    ${row("Launch", launchLine)}
    ${row("Launch mode", launch?.source)}
    ${row("Last scan", scanLine)}
  </div>

  <h2>Workspace</h2>
  <div class="card">
    ${row("Focused project", focused)}
    ${row("Registry", snapshot.settingsFlags.pckgBaseUrl)}
    ${row("Extension", extensionVersion)}
  </div>

  <h2>Quick actions</h2>
  <div class="card">
    <div class="actions">
      <button class="primary" data-command="beskid.lsp.restart">Restart LSP</button>
      <button data-command="beskid.cli.bootstrap">Setup toolchain</button>
      <button data-command="beskid.packages.open">Browse packages</button>
      <button data-command="beskid.refreshWorkspace">Refresh workspace</button>
      <button data-command="beskid.lsp.openLogs">Open logs</button>
      <button data-command="beskid.lsp.quickActions">More actions…</button>
    </div>
    <p class="hint">Formatting is provided by the Beskid language server (default formatter for .bd and manifest files).</p>
  </div>`;
}

/** Panel / status dashboard HTML (opened from status bar, not an editor tab). */
export function renderDashboardHtml(snapshot: LspRuntimeSnapshot, extensionVersion: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${WEBVIEW_CSP_META}
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
      margin: 0;
      line-height: 1.45;
    }
    ${DASHBOARD_STYLES}
  </style>
</head>
<body>
  ${renderDashboardBodyHtml(snapshot, extensionVersion)}
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-command]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'command', command: btn.getAttribute('data-command') });
      });
    });
  </script>
</body>
</html>`;
}
