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
- Trigger characters `.` and `:` drive member and `use` path completion from the language server
- Cross-module IntelliSense (`use` aliases, `IO.Member` completion) requires the file to live under a Beskid project with a resolved `Project.proj` / lockfile and materialized dependencies—the same project context the CLI uses for builds
- Trigger characters `.` and `:` drive member and path completion from the language server

## Development (Bun)

```bash
bun install
bun run build
```

Press `F5` in VS Code to run the extension in an Extension Development Host.

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
