# Beskid for VS Code

Language support for [Beskid](https://beskid-lang.org): syntax highlighting, IntelliSense, diagnostics, project and package management, and integrated CLI tasks — powered by the Beskid language server (`beskid_lsp`).

## Features

- **Language support** — `.bd` source and BSOL manifests (`.bproj`, `.bws`) with LSP diagnostics, completion, hover, go-to-definition, and formatting
- **Projects sidebar** — workspaces (`.bws`) as containers; expand a member to see targets, dependencies, and source folders in one tree
- **Graph Explorer** — interactive Mermaid dependency/module/host graphs in a webview panel (command palette: **Beskid: Show Project Graph**)
- **Packages** — local lockfile dependencies; browse the public [pckg](https://pckg.beskid-lang.org) registry in a document panel
- **Status dashboard** — click the status-bar **Beskid** item to open the Status panel (LSP health, toolchain, fetch/lock, common actions)
- **Symbol documentation** — open book docs from hover (“View documentation”) or **Beskid: Open Symbol Documentation**
- **CLI integration** — fetch, lock, build, test, and analyze via the command palette and task provider
- **Automatic toolchain** — downloads CLI and LSP from GitHub releases on first launch (configurable)

Cross-module IntelliSense requires a resolved project context (same `.bproj` / `Project.lock` layout the CLI uses for builds).

## Getting started

1. Install the extension from Open VSX (or run from source — see [Development](#development)).
2. Open a folder containing a `.bws` workspace manifest or a `.bproj` project manifest.
3. On first activate, the extension installs the Beskid CLI and LSP if needed and runs `beskid fetch`.
4. Click **Beskid** in the status bar for the quick panel, or open the **Beskid** activity bar for Projects and Packages.

## Sidebar views

| View | Purpose |
|------|---------|
| **Projects** | Workspaces and standalone projects; expand a project for targets, dependencies, and sources |
| **Packages** | Declared/locked deps; **Browse registry** opens the pckg catalog |
| **Debug** | LSP runtime state (hidden until `beskid.debug.enabled` is `true`; reload required) |

**Project focus** — click a workspace member or use **Beskid: Select Project**. The focused manifest drives diagnostics and package actions. Focus can change without restarting the LSP.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `beskid.project.autoSelectFromEditor` | `true` | Focus the nearest `.bproj` for the active editor |
| `beskid.cli.path` | `beskid` | CLI binary for fetch, lock, build, and tasks |
| `beskid.cli.releaseTag` | `cli-latest` | GitHub release tag for **Install CLI** |
| `beskid.lsp.releaseTag` | `lsp-latest` | GitHub release tag for **Install LSP** |
| `beskid.toolchain.autoInstallOnLaunch` | `true` | Download CLI/LSP on activate when missing |
| `beskid.toolchain.autoFetchDependencies` | `true` | Run `beskid fetch` once after first bootstrap |
| `beskid.pckg.baseUrl` | `https://pckg.beskid-lang.org` | Registry base URL |
| `beskid.pckg.apiKey` | *(empty)* | API key for private packages (public browse works without a key) |
| `beskid.debug.enabled` | `false` | Show the Debug sidebar view |
| `beskid.docs.bookBaseUrl` | `https://beskid-lang.org` | Book base URL for symbol documentation |

Additional LSP overrides: `beskid.lsp.server.path`, `beskid.lsp.server.devMode`, `beskid.lsp.server.preferBundled`, and related `beskid.lsp.server.*` keys.

## Commands (common)

| Command | Description |
|---------|-------------|
| **Beskid: Open Quick Panel** | Status dashboard in the bottom panel (`beskid.modal.open`) |
| **Beskid: Browse Packages** | Registry document panel |
| **Beskid: Select Project** / **Reveal in Projects** | Change or reveal project focus |
| **Beskid: Setup Toolchain** | Install CLI + LSP + fetch dependencies |
| **Beskid: Refresh Workspace** | Re-sync LSP project graph |
| **Beskid: Show Project Graph** | Open Graph Explorer (Mermaid dependency/workspace/module views) |
| **Beskid: Open Symbol Documentation** | Open book page for symbol under cursor |

Use **Beskid: LSP Quick Actions** for the full command list.

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run build
bun run lint
bun run test:unit
bun run test:integration   # first run downloads VS Code into .vscode-test/
bun run test:all
```

Press **F5** to launch an Extension Development Host. The launch config bundles the host LSP binary and compiles TypeScript first.

When developing in the [beskid superrepo](https://github.com/Cyber-Nomad-Collective/beskid), the extension can use a local `compiler/target/release/beskid_lsp` build or `cargo run -p beskid_lsp` if `beskid.lsp.server.devMode` is enabled.

### Manual smoke

1. Open a folder with `.bws` / `.bproj` manifests and start the Extension Development Host (**F5**).
2. **Projects** lists the workspace; expand a member to see targets, dependencies, and sources.
3. Click the status-bar **Beskid** item — the Status panel opens above the status bar (not a new editor tab).
4. **Packages** → **Browse registry…** — public catalog without an API key.
5. Hover a symbol → **View documentation**, or run **Open Symbol Documentation**.

## Publishing and repository layout

This repo is the **`beskid_vscode` submodule** in the aggregate [beskid](https://github.com/Cyber-Nomad-Collective/beskid) monorepo. Open VSX publishing runs from the superrepo workflow `publish-open-vsx.yml` (builds `beskid_lsp`, bundles platform binaries under `server/`, packages the VSIX). Bundled LSP payloads under `server/` are not committed locally.

## Language server resolution

On activate (unless auto-install is disabled, dev mode is on, or `beskid.lsp.server.path` is set):

1. Managed CLI at `~/.beskid/bin/beskid` (from GitHub `cli-latest`)
2. Managed LSP at `~/.beskid/bin/beskid_lsp` (from GitHub `lsp-latest`)
3. `beskid fetch` for open manifests when `beskid.toolchain.autoFetchDependencies` is enabled
4. Start the language server

Override order when starting LSP: explicit `beskid.lsp.server.path` → managed LSP → VSIX-bundled binary (`beskid.lsp.server.preferBundled`) → managed CLI `beskid lsp` → local compiler build.

Progress appears in the status bar and **Beskid LSP** output channel. Use **Beskid: Setup Toolchain** to retry after failure.
