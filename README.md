# Beskid for VS Code

Language support for [Beskid](https://beskid-lang.org): syntax highlighting, IntelliSense, diagnostics, project and package management, and integrated CLI tasks — powered by the Beskid language server (`beskid_lsp`).

## Features

- **Language support** — `.bd` source with diagnostics, completion, hover,
  go-to-definition, and formatting; BSOL manifests (`.bproj`, `.bws`) and
  standalone `.bsol` configuration with one shared grammar plus LSP
  diagnostics, completion, hover, and semantic highlighting
- **Projects sidebar** — workspaces (`.bws`) as containers; expand a member to see targets, dependencies, and source folders in one tree
- **Graph Explorer** — interactive Mermaid dependency/module/host graphs in a webview panel (command palette: **Beskid: Show Project Graph**)
- **Packages** — local lockfile dependencies; browse the public [pckg](https://pckg.beskid-lang.org) registry in a document panel
- **Status dashboard** — click the status-bar **Beskid** item to open the Status panel (LSP health, toolchain, fetch/lock, common actions)
- **Symbol documentation** — open book docs from hover (“View documentation”) or **Beskid: Open Symbol Documentation**
- **CLI integration** — `check`, `build`, `test`, and `dev project fetch|lock` via the command palette and task provider; requires the Beskid 0.6 CLI
- **Automatic toolchain** — downloads CLI and LSP from GitHub releases on first launch (configurable)

Cross-module IntelliSense requires a resolved project context (same `.bproj` / `Project.lock` layout the CLI uses for builds).

## Getting started

1. Install the extension from Open VSX (or run from source — see [Development](#development)).
2. Open a folder containing a `.bws` workspace manifest or a `.bproj` project manifest.
3. On first activate, the extension installs the Beskid CLI and LSP if needed and runs `beskid dev project fetch`.
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
| `beskid.cli.path` | `beskid` | CLI binary for check, build, test, fetch, lock, and tasks (Beskid 0.6 or later) |
| `beskid.cli.releaseTag` | `cli-stable` | GitHub release tag for **Install CLI**. Supports `cli-stable`/`cli-unstable`, and migrates legacy `cli-latest` to pinned `cli-v*` releases. |
| `beskid.lsp.releaseTag` | `lsp-stable` | GitHub release tag for **Install LSP**. Supports `lsp-stable`/`lsp-unstable`, and migrates legacy `lsp-latest` to pinned `lsp-v*` releases. |
| `beskid.toolchain.autoInstallOnLaunch` | `true` | Download CLI/LSP on activate when missing |
| `beskid.toolchain.autoFetchDependencies` | `true` | Run `beskid dev project fetch` once after first bootstrap |
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
bun run test:integration   # builds the sibling compiler LSP and downloads VS Code on first run
bun run test:all
```

For a standalone `beskid_vscode` checkout, set `BESKID_TEST_LSP_PATH` to an
already-built `beskid_lsp` binary before running the integration suite.

Press **F5** to launch an Extension Development Host. The launch config bundles the host LSP binary and compiles TypeScript first.

When developing in the [beskid superrepo](https://github.com/Cyber-Nomad-Collective/beskid), the extension can use a local `compiler/target/release/beskid_lsp` build or `cargo run -p beskid_lsp` if `beskid.lsp.server.devMode` is enabled.

### Manual smoke

1. Open a folder with `.bws` / `.bproj` manifests or a standalone `.bsol` configuration and start the Extension Development Host (**F5**).
2. **Projects** lists the workspace; expand a member to see targets, dependencies, and sources.
3. Click the status-bar **Beskid** item — the Status panel opens above the status bar (not a new editor tab).
4. **Packages** → **Browse registry…** — public catalog without an API key.
5. Hover a symbol → **View documentation**, or run **Open Symbol Documentation**.

## Publishing and repository layout

This repo is the **`beskid_vscode` submodule** in the aggregate [beskid](https://github.com/Cyber-Nomad-Collective/beskid) monorepo. Prepare maintained release packages from verified native evidence using `node scripts/ci/package-editor-release.mjs <platform> <native-evidence-root> <native-root-commit>` in the aggregate root. Platforms are `linux-x64`, `darwin-arm64`, and `win32-x64`; the evidence root contains the corresponding `linux`, `macos`, or `windows` directory and complete checksum inventory. This packages the exact verified LSP without rebuilding compiler sources. Stage one platform per clean editor checkout. Bundled LSP payloads under `server/` are not committed locally.

The resulting versioned VSIX can be submitted to both Visual Studio Marketplace and Open VSX using their maintained publisher accounts. Package preparation requires clean tracked root and editor source and the checked-out editor revision pinned by the root gitlink. It has no registry side effects. Marketplace publication runs on the trusted manual release host after reviewing the verified artifact.

## Language server resolution

On activate (unless auto-install is disabled, dev mode is on, or `beskid.lsp.server.path` is set):

1. Managed CLI at `~/.beskid/bin/beskid` (from GitHub `cli-stable` / `cli-unstable`, with legacy `cli-latest` migration)
2. Managed LSP at `~/.beskid/bin/beskid_lsp` (from GitHub `lsp-stable` / `lsp-unstable`, with legacy `lsp-latest` migration)
3. `beskid dev project fetch` for open manifests when `beskid.toolchain.autoFetchDependencies` is enabled
4. Start the language server

Override order when starting LSP: explicit `beskid.lsp.server.path` → managed LSP → VSIX-bundled binary (`beskid.lsp.server.preferBundled`) → managed CLI `beskid dev lsp` → local compiler build.

The extension negotiates the CLI command surface with `beskid dev capabilities --json` before it runs the CLI. A CLI that does not answer, or that does not list `check`, `build`, `test`, `dev lsp`, and `dev project`, is rejected with upgrade guidance: run `beskid toolchain update` or install Beskid 0.6. Commands from Beskid 0.5 and earlier (`analyze`, `lsp`, `fetch`, `lock`, `pckg`) are never invoked.

Project operations pass `--project <bproj>` when a project manifest is focused. Tasks of type `beskid-fetch`, `beskid-lock`, `beskid-build`, `beskid-test`, and `beskid-check` accept `projectPath` as a project directory or a `.bproj` manifest.

Progress appears in the status bar and **Beskid LSP** output channel. Use **Beskid: Setup Toolchain** to retry after failure.

## License

Beskid-owned source in this repository is licensed under the
[Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for bundled third-party
attributions.
