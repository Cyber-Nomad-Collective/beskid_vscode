# Beskid VS Code Extension

VS Code support for Beskid source (`.bd`) and project (`.proj`) files, powered by the Beskid Language Server Protocol (LSP) server.

## Superrepo and CI

This repository is the canonical home for extension sources. It is wired into the aggregate repo as the **`beskid_vscode` submodule** ([`Cyber-Nomad-Collective/beskid`](https://github.com/Cyber-Nomad-Collective/beskid)).

GitHub Actions and Open VS X publishing run **only from the superrepo** — workflow [`publish-open-vsx.yml`](https://github.com/Cyber-Nomad-Collective/beskid/blob/main/.github/workflows/publish-open-vsx.yml) builds `beskid_lsp`, bundles platform binaries under `server/`, packages the VSIX, and publishes. Avoid adding a second publish pipeline in this repository.

Bundled LSP payloads under `server/` are not committed (see `.gitignore`); local installs place binaries there when packaging.

## Features

- Activates on `beskid` language files
- Associates both `.bd` and `.proj` with Beskid
- Uses bundled platform LSP binaries by default (`server/<platform>-<arch>/`)
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
| `beskid.cli.path` | `beskid` | Beskid CLI binary for fetch, lock, build, and tasks |
| `beskid.pckg.baseUrl` | `http://localhost:5000` | pckg registry base URL |
| `beskid.pckg.apiKey` | *(empty)* | Optional API key for private registry access (also stored in SecretStorage) |

## Development (Bun)

```bash
bun install
bun run build
bun run lint
bun test
```

Press `F5` in VS Code to run the extension in an Extension Development Host.

```bash
bun run test:e2e
```

### Manual smoke (corelib workspace)

1. Open the aggregate repo (or `compiler/corelib`) with a `Workspace.proj` / `Project.proj` layout and start the Extension Development Host (`F5`).
2. Confirm **Workspaces** lists members; click a member and verify **Project** shows graph targets/dependencies and **Outline** updates.
3. Open a `.bd` file under a project; use the editor title **Reveal in Project** control and confirm the **Project** tree reveals the focused manifest.
4. In **Packages**, run **Search packages** for `corelib`; open details, then **Add Package Dependency** and confirm `Project.proj` gains a `dependency` block.
5. Run **Beskid: Fetch Packages** (or **CLI Fetch**); refresh and confirm locked rows appear; if the registry requires auth, use **Configure Package Registry API Key** and retry search.

## Default server command

By default the extension runs the bundled LSP binary for your platform.

If the bundled binary is unavailable, either:
- set `beskid.lsp.server.path` to a local `beskid_lsp` binary, or
- enable `beskid.lsp.server.devMode` and use source mode:

```bash
cargo run -p beskid_lsp
```

with CWD = workspace root.

You can override in VS Code settings:

- `beskid.lsp.server.devMode`
- `beskid.lsp.server.command`
- `beskid.lsp.server.args`
- `beskid.lsp.server.cwd`
- `beskid.lsp.server.debugArgs`
- `beskid.lsp.server.path`
