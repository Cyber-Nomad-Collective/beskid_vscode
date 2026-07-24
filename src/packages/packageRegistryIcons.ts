/** Inline SVG icons for the package registry webview (currentColor, 16×16). */

const SVG_OPEN = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M11 3a1 1 0 1 0 0 2h1.586L8.293 9.293a1 1 0 1 0 1.414 1.414L14 6.414V8a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-4Z"/><path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z"/></svg>`;

const SVG_BOOK = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 3a2 2 0 0 0-2 2v11.5A1.5 1.5 0 0 0 5.5 18h9.75A1.75 1.75 0 0 0 17 16.25V5a2 2 0 0 0-2-2H6Zm0 2h8v11H6V5Zm2 2.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 8 7.5Zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 8 10.5Z"/></svg>`;

const SVG_ADD = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3a1 1 0 0 0-2 0v4H5a1 1 0 1 0 0 2h4v4a1 1 0 1 0 2 0v-4h4a1 1 0 1 0 0-2h-4V5Z"/></svg>`;

const SVG_COPY = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M8 3a2 2 0 0 0-2 2v1h-.5A2.5 2.5 0 0 0 3 8.5v8A2.5 2.5 0 0 0 5.5 19h7a2.5 2.5 0 0 0 2.5-2.5V16h1.5A2.5 2.5 0 0 0 19 13.5v-8A2.5 2.5 0 0 0 16.5 3H8Zm0 2h8.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H8V5Zm-2.5 3H5.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5H7v-9Z"/></svg>`;

const SVG_REFRESH = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3a7 7 0 0 1 6.32 4H14a1 1 0 1 0 0 2h4.5a.5.5 0 0 0 .5-.5V4a1 1 0 1 0-2 0v1.71A9 9 0 1 0 10 19a1 1 0 1 0 0-2 7 7 0 0 1 0-14Z"/></svg>`;

const SVG_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M8.5 3a5.5 5.5 0 1 0 3.45 9.82l3.6 3.6a1 1 0 0 0 1.42-1.42l-3.6-3.6A5.5 5.5 0 0 0 8.5 3Zm0 2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"/></svg>`;

export function actionButton(
	attrs: string,
	icon: string,
	label: string,
	primary = false,
): string {
	const cls = primary ? "action-btn primary" : "action-btn";
	return `<button type="button" class="${cls}" ${attrs}>
    <span class="btn-icon">${icon}</span>
    <span class="btn-label">${label}</span>
  </button>`;
}

export const registryIcons = {
	openBrowser: SVG_OPEN,
	apiDocs: SVG_BOOK,
	addDependency: SVG_ADD,
	copy: SVG_COPY,
	refresh: SVG_REFRESH,
	search: SVG_SEARCH,
} as const;
