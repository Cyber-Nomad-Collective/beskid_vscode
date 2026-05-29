# Beskid VS Code Extension

VS Code support for Beskid source (`.bd`) and project (`.proj`) files, powered by the Beskid Language Server Protocol (LSP) server.

## Superrepo and CI

This repository is the canonical home for extension sources. It is wired into the aggregate repo as the **`beskid_vscode` submodule** ([`Cyber-Nomad-Collective/beskid`](https://github.com/Cyber-Nomad-Collective/beskid)).

GitHub Actions and Open VS X publishing run **only from the superrepo** — workflow [`publish-open-vsx.yml`](https://github.com/Cyber-Nomad-Collective/beskid/blob/main/.github/workflows/publish-open-vsx.yml) builds `beskid_lsp`, bundles platform binaries under `server/`, packages the VSIX, and publishes. Avoid adding a second publish pipeline in this repository.

Bundled LSP payloads under `server/` are not committed (see `.gitignore`); local installs place binaries there when packaging.

## Features

- Activates on `beskid` language files
- Associates both `.bd` and `.proj` with Beskid
- Uses GitHub CLI releases for the language server (`beskid lsp`) and project commands (fetch, lock, build, …)
- Optional VSIX-bundled LSP binaries when `beskid.lsp.server.preferBundled` is enabled
- Supports explicit local binary override via `beskid.lsp.server.path`
- Supports source/dev launch mode for compiler contributors
- Cross-module IntelliSense (`use` aliases, `IO.Member` completion) requires the open file to live under a Beskid project with a resolved `Project.proj` / lockfile and materialized dependencies—the same project context the CLI uses for builds
- Trigger characters `.` and `:` drive member and path completion from the language server
- **Workspaces**, **Project**, **Outline**, and **Packages** tree views under the Beskid activity bar (workspace members, focused project graph, registry search, local lockfile deps)
- LSP `focusedProjectUri` (and deprecated `selectedProjectUri`) align diagnostics with the focused manifest; change focus without restarting LSP when only the project changes

### Tree views

| View | Id | Purpose |
|------|-----|---------|
| Workspaces | `beskidWorkspaceView` | `Workspace.proj` roots and members |
| Project | `beskidProjectView` | Focused project targets, dependencies, sources |
| Outline | `beskidProjectOutlineView` | Symbols for the focused project |
| Packages | `beskidPackagesView` | Local lockfile deps and registry search |

### Workspace settings

| Setting | Default | Description |
|---------|---------|-------------|
| `beskid.project.autoSelectFromEditor` | `true` | Focus the nearest `Project.proj` for the active editor |
| `beskid.cli.path` | `beskid` | Beskid CLI binary for fetch, lock, build, and tasks (uses `~/.beskid/bin/beskid` when installed via the extension) |
| `beskid.cli.releaseTag` | `cli-latest` | GitHub release tag for **Beskid: Install CLI** (`cli-latest`, `cli-vX.Y.Z`, or bare semver) |
| `beskid.lsp.releaseTag` | `lsp-latest` | GitHub release tag for **Beskid: Install LSP** (`lsp-latest`, `lsp-vX.Y.Z`, or bare semver) |
| `beskid.toolchain.autoInstallOnLaunch` | `true` | Download CLI/LSP from GitHub on activate when missing or outdated |
| `beskid.toolchain.autoFetchDependencies` | `true` | Run `beskid fetch` once on first successful bootstrap |
| `beskid.pckg.baseUrl` | `http://localhost:5000` | pckg registry base URL |
| `beskid.pckg.apiKey` | *(empty)* | Optional API key for private registry access (also stored in SecretStorage) |

## Development (Bun)

```bash
bun install
bun run build
bun run lint
bun run test:unit
bun run test:integration   # first run downloads VS Code into .vscode-test/
bun run test:all
```

Press `F5` in VS Code to run the extension in an Extension Development Host. The launch config bundles the host LSP binary and compiles TypeScript first (`bun run bundle:lsp` + `bun run build`).

If the bundled binary is missing, the extension also tries a local `compiler/target/release/beskid_lsp` build and auto-launches via `cargo run -p beskid_lsp` when a sibling `compiler/` workspace is present (superrepo checkout).

### Test layout

| Layer | Runner | Scope |
|-------|--------|--------|
| Unit | Bun (`test/**/*.test.ts`, not `test/integration/`) | Pure helpers, manifest contracts, mocked view registration |
| Integration | [@vscode/test-electron](https://www.npmjs.com/package/@vscode/test-electron) + Mocha | Extension activation, sidebar view focus commands, command palette entries |
| Smoke | Bun (`test/e2e/`) | `package.json` contribution checks |

Integration tests launch a real VS Code build with `--disable-extensions` and verify that every sidebar view (including **Debug**) registers a `.focus` command.

### Manual smoke (corelib workspace)

1. Open the aggregate repo (or `compiler/corelib`) with a `Workspace.proj` / `Project.proj` layout and start the Extension Development Host (`F5`).
2. Confirm **Workspaces** lists members; click a member and verify **Project** shows graph targets/dependencies and **Outline** updates.
3. Open a `.bd` file under a project; use the editor title **Reveal in Project** control and confirm the **Project** tree reveals the focused manifest.
4. In **Packages**, run **Search packages** for `corelib`; open details, then **Add Package Dependency** and confirm `Project.proj` gains a `dependency` block.
5. Run **Beskid: Fetch Packages** (or **CLI Fetch**); refresh and confirm locked rows appear; if the registry requires auth, use **Configure Package Registry API Key** and retry search.

## Default language server

On activate the extension **automatically** prepares the toolchain (unless `beskid.toolchain.autoInstallOnLaunch` is false, `beskid.lsp.server.devMode` is enabled, or `beskid.lsp.server.path` is set):

1. Checks for managed CLI at `~/.beskid/bin/beskid` — downloads from GitHub (`cli-latest` by default) when missing or too old for `beskid lsp`
2. Checks for managed LSP at `~/.beskid/bin/beskid_lsp` — downloads from GitHub (`lsp-latest` by default) when missing
3. Runs **`beskid fetch`** for each open `Workspace.proj` / `Project.proj` on first launch (disable with `beskid.toolchain.autoFetchDependencies`)
4. Starts the language server

Progress appears in the status bar and a short notification while downloads run. Details log to the **Beskid LSP** output channel. Use **Beskid: Setup Toolchain** to retry after a failure.

Resolution order when starting the LSP:

1. `beskid.lsp.server.path` — explicit LSP binary
2. Managed LSP — `~/.beskid/bin/beskid_lsp` (installed from GitHub `lsp-latest` / `lsp-vX.Y.Z`)
3. VSIX-bundled `server/<platform>-<arch>/beskid_lsp` when `beskid.lsp.server.preferBundled` is true
4. Managed CLI — `beskid lsp` from an up-to-date `beskid.cli.path` or `~/.beskid/bin/beskid`
5. Local `compiler/target/release/beskid_lsp` or `cargo run -p beskid_lsp` when developing in the superrepo

## Default server command (contributors)

For compiler work in a cloned superrepo, enable `beskid.lsp.server.devMode` or rely on the auto-detected `compiler/` workspace:

```bash
cargo run -p beskid_lsp
```

You can override in VS Code settings:

- `beskid.lsp.server.devMode`
- `beskid.lsp.server.command`
- `beskid.lsp.server.args`
- `beskid.lsp.server.cwd`
- `beskid.lsp.server.debugArgs`
- `beskid.lsp.server.path`
