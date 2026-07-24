import { buildPckgDocsUrl } from "../commands/docsUrls.js";
import { escapeHtml } from "../webviews/webviewHtml.js";
import { actionButton, registryIcons } from "./packageRegistryIcons.js";
import type {
	PackageDetails,
	PackageKind,
	PackageSearchRow,
} from "./pckgTypes.js";
import { renderPackageMarkdown } from "./renderPackageMarkdown.js";

export type RegistryPanelState = {
	query: string;
	loading: boolean;
	error?: string;
	rows: PackageSearchRow[];
	selected?: string;
	details?: PackageDetails;
	detailsLoading?: boolean;
	registryBaseUrl: string;
	logoUri?: string;
};

const PACKAGE_REGISTRY_CSP =
	"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https: data:;\" />";

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
	const version =
		details.latestVersion ?? details.versions[0]?.version ?? "latest";
	const actions: string[] = [
		actionButton(
			`data-open-browser="${escapeHtml(browserUrl)}"`,
			registryIcons.openBrowser,
			"Open in browser",
			true,
		),
	];

	if (kind === "library" || kind === "tool") {
		const docsUrl = buildPckgDocsUrl(name, version, undefined, {
			pckgBaseUrl: baseUrl,
		});
		actions.push(
			actionButton(
				`data-open-browser="${escapeHtml(docsUrl)}"`,
				registryIcons.apiDocs,
				"Open API docs",
			),
		);
	}

	if (kind === "template") {
		const shortName = details.package.shortName ?? name.split(".").pop() ?? name;
		actions.push(
			actionButton(
				`data-copy="beskid new install ${name}"`,
				registryIcons.copy,
				"Copy install command",
			),
			actionButton(
				`data-copy="beskid new ${shortName}"`,
				registryIcons.copy,
				`Copy: beskid new ${escapeHtml(shortName)}`,
			),
		);
	} else if (kind === "library") {
		actions.push(
			actionButton(
				`data-command="beskid.packages.addDependency"`,
				registryIcons.addDependency,
				"Add dependency…",
			),
		);
	} else if (kind === "tool") {
		const ver = details.latestVersion ?? details.versions[0]?.version ?? "latest";
		actions.push(
			actionButton(
				`data-copy="beskid pckg download ${name}@${ver}"`,
				registryIcons.copy,
				"Copy download command",
			),
		);
	}

	return `<div class="detail-actions">${actions.join("")}</div>`;
}

function renderPackageIcon(details: PackageDetails): string {
	const name = details.package.name;
	const initial = escapeHtml(name.slice(0, 1).toUpperCase());
	const iconUrl = details.package.iconUrl?.trim();
	if (iconUrl) {
		return `<img class="package-icon" src="${escapeHtml(iconUrl)}" alt="" referrerpolicy="no-referrer" />`;
	}
	return `<div class="package-icon package-icon-placeholder" aria-hidden="true">${initial}</div>`;
}

function renderReadme(readme: string): string {
	const html = renderPackageMarkdown(readme);
	if (!html) {
		return "";
	}
	return `<h3>Readme</h3><div class="readme markdown-body">${html}</div>`;
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
		.map(
			(v) => `<li>${escapeHtml(v.version)}${v.isYanked ? " (yanked)" : ""}</li>`,
		)
		.join("");

	return `<div class="detail">
    <div class="detail-header">
      ${renderPackageIcon(state.details)}
      <div class="detail-header-main">
        <div class="detail-title-row">
          <h1>${escapeHtml(pkg.name)}</h1>
          <span class="kind-badge">${escapeHtml(kind)}</span>
        </div>
        ${pkg.shortName ? `<p class="meta">shortName: <code>${escapeHtml(pkg.shortName)}</code></p>` : ""}
        <p class="desc">${escapeHtml(pkg.description?.trim() || "No description.")}</p>
      </div>
    </div>
    ${renderDetailActions(state.details, state.registryBaseUrl)}
    ${versions ? `<h3>Versions</h3><ul class="versions">${versions}</ul>` : ""}
    ${readme ? renderReadme(readme) : ""}
  </div>`;
}

function renderToolbar(state: RegistryPanelState): string {
	const logo = state.logoUri
		? `<img class="toolbar-logo" src="${escapeHtml(state.logoUri)}" alt="Beskid" />`
		: "";
	return `<div class="toolbar">
    <div class="toolbar-brand">
      ${logo}
      <span class="toolbar-kicker">Beskid</span>
      <span class="toolbar-app">pckg</span>
    </div>
    <div class="search-shell">
      <span class="search-icon">${registryIcons.search}</span>
      <input type="search" id="search" placeholder="Search packages…" value="${escapeHtml(state.query)}" />
    </div>
    ${actionButton('id="refresh"', registryIcons.refresh, "Refresh")}
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
  ${PACKAGE_REGISTRY_CSP}
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
      gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      align-items: center;
    }
    .toolbar-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      padding-right: 4px;
      border-right: 1px solid var(--vscode-panel-border);
      margin-right: 2px;
    }
    .toolbar-logo {
      width: 22px;
      height: auto;
      flex-shrink: 0;
    }
    .toolbar-kicker {
      font-size: 11px;
      opacity: 0.75;
    }
    .toolbar-app {
      font-weight: 600;
      font-size: 13px;
    }
    .search-shell {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 0 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
    }
    .search-icon {
      display: flex;
      width: 16px;
      height: 16px;
      opacity: 0.65;
      flex-shrink: 0;
    }
    .search-icon svg { width: 16px; height: 16px; }
    .search-shell input {
      flex: 1;
      min-width: 0;
      padding: 6px 0;
      background: transparent;
      color: var(--vscode-input-foreground);
      border: none;
      outline: none;
      font: inherit;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      border-radius: 4px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      white-space: nowrap;
    }
    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-secondaryBackground));
    }
    .action-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: transparent;
    }
    .action-btn.primary:hover {
      background: var(--vscode-button-hoverBackground, var(--vscode-button-background));
    }
    .btn-icon {
      display: flex;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .btn-icon svg { width: 16px; height: 16px; }
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
    .detail-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 4px;
    }
    .package-icon {
      width: 52px;
      height: 52px;
      border-radius: 10px;
      object-fit: cover;
      border: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .package-icon-placeholder {
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, var(--vscode-textLink-foreground), var(--vscode-button-background));
      color: var(--vscode-editor-background);
      font-size: 1.4rem;
      font-weight: 700;
    }
    .detail-header-main { min-width: 0; flex: 1; }
    .detail-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .detail h1 { margin: 0; font-size: 18px; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 16px; }
    .detail h3 {
      margin: 18px 0 8px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.85;
    }
    .readme {
      font-size: 13px;
      line-height: 1.55;
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-panel-border);
      padding: 14px 16px;
      border-radius: 6px;
      max-height: 480px;
      overflow: auto;
    }
    .markdown-body p { margin: 0 0 12px; }
    .markdown-body p:last-child { margin-bottom: 0; }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
      margin: 16px 0 8px;
      line-height: 1.25;
    }
    .markdown-body h1 { font-size: 1.35em; }
    .markdown-body h2 { font-size: 1.15em; }
    .markdown-body h3 { font-size: 1.05em; text-transform: none; letter-spacing: normal; opacity: 1; margin-top: 14px; }
    .markdown-body ul, .markdown-body ol { margin: 8px 0 12px; padding-left: 22px; }
    .markdown-body li { margin: 4px 0; }
    .markdown-body code {
      background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.15));
      padding: 2px 5px;
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.92em;
    }
    .markdown-body pre {
      margin: 10px 0;
      padding: 10px 12px;
      border-radius: 4px;
      overflow: auto;
      background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.15));
    }
    .markdown-body pre code {
      padding: 0;
      background: transparent;
    }
    .markdown-body blockquote {
      margin: 10px 0;
      padding: 4px 0 4px 12px;
      border-left: 3px solid var(--vscode-textLink-foreground);
      opacity: 0.9;
    }
    .markdown-body a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    .markdown-body a:hover { text-decoration: underline; }
    .markdown-body table {
      border-collapse: collapse;
      margin: 10px 0;
      width: 100%;
    }
    .markdown-body th, .markdown-body td {
      border: 1px solid var(--vscode-panel-border);
      padding: 6px 10px;
      text-align: left;
    }
    .markdown-body hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 14px 0;
    }
    .versions { font-size: 12px; padding-left: 20px; margin: 0; }
    .meta, .desc { margin: 6px 0 0; }
    .desc { opacity: 0.9; }
    .list-empty { padding: 16px; font-size: 12px; }
    .list-empty.error { color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  ${renderToolbar(state)}
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
      const link = e.target.closest('.readme a[href]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          vscode.postMessage({ type: 'openBrowser', url: href });
        }
      }
    });
  </script>
</body>
</html>`;
}
