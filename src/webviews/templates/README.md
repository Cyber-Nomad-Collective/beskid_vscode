# Beskid extension webviews

Reusable webview scaffolding for sidebar panels beyond tree views.

- **`WebviewHost.ts`** — base binding for `WebviewViewProvider` instances (CSP, HTML refresh).
- **`templatesPanel.ts`** — stub types and provider for a future **Templates** panel (search/install). Not registered in `package.json` until the feature ships.

When adding a new panel:

1. Define `viewType` constant and message/state types in a dedicated module.
2. Register `vscode.window.registerWebviewViewProvider` from `src/activation/`.
3. Drive UI from `LspRuntimeState` or a feature-specific store; avoid polling loops.
