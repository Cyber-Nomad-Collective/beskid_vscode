import type { PackageDetails, PackageKind, PackageSearchRow } from "./pckgTypes.js";
import { escapeHtml, WEBVIEW_CSP_META } from "../webviews/webviewHtml.js";

export type RegistryPanelState = {
  query: string;
  loading: boolean;
  error?: string;
  rows: PackageSearchRow[];
  selected?: string;
  details?: PackageDetails;
  detailsLoading?: boolean;
  registryBaseUrl: string;
};

function kindLabel(kind: PackageKind | undefined): string {
  return kind ?? "library";
}

function renderListItem(row: PackageSearchRow, selected?: string): string {
  const name = row.package.name;
  const active = selected === name ? " active" : "";
  const kind = kindLabel(row.package.packageKind);
  const desc = row.package.description?.trim().slice(0, 80) ?? "";
  return `<button type="button" class="pkg-item${active}" data-select="${escapeHtml(name)}">
    <span class="pkg-name">${escapeHtml(name)}</span>
    <span class="kind-badge">${escapeHtml(kind)}</span>
    ${desc ? `<span class="pkg-desc">${escapeHtml(desc)}</span>` : ""}
  </button>`;
}

function renderDetailActions(details: PackageDetails, baseUrl: string): string {
  const kind = kindLabel(details.package.packageKind);
  const name = details.package.name;
  const browserUrl = `${baseUrl.replace(/\/$/, "")}/packages/${encodeURIComponent(name)}`;
  const actions: string[] = [
    `<button class="primary" data-open-browser="${escapeHtml(browserUrl)}">Open in browser</button>`,
  ];

  if (kind === "template") {
    const shortName = details.package.shortName ?? name.split(".").pop() ?? name;
    actions.push(
      `<button data-copy="beskid new install ${name}">Copy: beskid new install</button>`,
      `<button data-copy="beskid new ${shortName}">Copy: beskid new ${escapeHtml(shortName)}</button>`,
    );
  } else if (kind === "library") {
    actions.push(`<button data-command="beskid.packages.addDependency">Add dependency…</button>`);
  } else if (kind === "tool") {
    const ver = details.latestVersion ?? details.versions[0]?.version ?? "latest";
    actions.push(
      `<button data-copy="beskid pckg download ${name}@${ver}">Copy download command</button>`,
    );
  }

  return `<div class="detail-actions">${actions.join("")}</div>`;
}

function renderDetailPane(state: RegistryPanelState): string {
  if (state.detailsLoading) {
    return `<div class="detail-empty">Loading details…</div>`;
  }
  if (!state.selected) {
    return `<div class="detail-empty">Select a package to view details.</div>`;
  }
  if (!state.details) {
    return `<div class="detail-empty">No details loaded.</div>`;
  }
  const pkg = state.details.package;
  const kind = kindLabel(pkg.packageKind);
  const readme = state.details.readme?.trim();
  const versions = state.details.versions
    .slice(0, 10)
    .map((v) => `<li>${escapeHtml(v.version)}${v.isYanked ? " (yanked)" : ""}</li>`)
    .join("");

  return `<div class="detail">
    <div class="detail-header">
      <h1>${escapeHtml(pkg.name)}</h1>
      <span class="kind-badge">${escapeHtml(kind)}</span>
    </div>
    ${pkg.shortName ? `<p class="meta">shortName: <code>${escapeHtml(pkg.shortName)}</code></p>` : ""}
    <p class="desc">${escapeHtml(pkg.description?.trim() || "No description.")}</p>
    ${renderDetailActions(state.details, state.registryBaseUrl)}
    ${versions ? `<h3>Versions</h3><ul class="versions">${versions}</ul>` : ""}
    ${readme ? `<h3>Readme</h3><pre class="readme">${escapeHtml(readme.slice(0, 4000))}</pre>` : ""}
  </div>`;
}

export function renderPackageRegistryHtml(state: RegistryPanelState): string {
  const listContent = state.loading
    ? `<div class="list-empty">Loading…</div>`
    : state.error
      ? `<div class="list-empty error">${escapeHtml(state.error)}</div>`
      : state.rows.length === 0
        ? `<div class="list-empty">No packages found.</div>`
        : state.rows.map((row) => renderListItem(row, state.selected)).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${WEBVIEW_CSP_META}
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      align-items: center;
    }
    .toolbar input {
      flex: 1;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font: inherit;
    }
    .toolbar button {
      padding: 6px 12px;
      font: inherit;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .layout {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(220px, 34%) 1fr;
      min-height: 0;
    }
    .list {
      overflow: auto;
      border-right: 1px solid var(--vscode-panel-border);
      padding: 4px;
    }
    .pkg-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      text-align: left;
      padding: 8px 10px;
      margin-bottom: 2px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }
    .pkg-item:hover { background: var(--vscode-list-hoverBackground); }
    .pkg-item.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    .pkg-name { font-weight: 600; font-size: 13px; }
    .pkg-desc { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .kind-badge {
      font-size: 10px;
      text-transform: uppercase;
      padding: 1px 6px;
      border-radius: 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      margin-top: 4px;
    }
    .detail-pane { overflow: auto; padding: 16px 20px; }
    .detail-empty { opacity: 0.7; padding: 24px; }
    .detail h1 { margin: 0 0 8px; font-size: 18px; }
    .detail-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .detail-actions button {
      padding: 6px 12px;
      font: inherit;
      border-radius: 4px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
    }
    .detail-actions button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .readme {
      white-space: pre-wrap;
      font-size: 12px;
      background: var(--vscode-textBlockQuote-background);
      padding: 10px;
      border-radius: 4px;
      max-height: 320px;
      overflow: auto;
    }
    .versions { font-size: 12px; padding-left: 20px; }
    .list-empty { padding: 16px; font-size: 12px; }
    .list-empty.error { color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <div class="toolbar">
    <input type="search" id="search" placeholder="Search packages…" value="${escapeHtml(state.query)}" />
    <button id="refresh">Refresh</button>
  </div>
  <div class="layout">
    <div class="list" id="list">${listContent}</div>
    <div class="detail-pane">${renderDetailPane(state)}</div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const search = document.getElementById('search');
    let debounce;
    search?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        vscode.postMessage({ type: 'search', query: search.value });
      }, 300);
    });
    search?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(debounce);
        vscode.postMessage({ type: 'search', query: search.value });
      }
    });
    document.getElementById('refresh')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });
    document.getElementById('list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-select]');
      if (btn) vscode.postMessage({ type: 'select', name: btn.getAttribute('data-select') });
    });
    document.querySelector('.detail-pane')?.addEventListener('click', (e) => {
      const browser = e.target.closest('[data-open-browser]');
      if (browser) {
        vscode.postMessage({ type: 'openBrowser', url: browser.getAttribute('data-open-browser') });
        return;
      }
      const copy = e.target.closest('[data-copy]');
      if (copy) vscode.postMessage({ type: 'copy', text: copy.getAttribute('data-copy') });
      const cmd = e.target.closest('[data-command]');
      if (cmd) vscode.postMessage({ type: 'command', command: cmd.getAttribute('data-command') });
    });
  </script>
</body>
</html>`;
}
