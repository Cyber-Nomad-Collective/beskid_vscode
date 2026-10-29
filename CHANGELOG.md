# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Select the toolchain by identity: setting, then the bundled server, then `~/.beskid/bin` only when `beskid dev capabilities` reports the same version and runtime ABI. A mismatch shows a warning with **Remove stale toolchain**, which also offers to remove old Beskid extension folders after a confirmation that lists them.
- Show one notification per `beskid/crashReport` from the language server, with an **Open report** action.

### Changed

- Resolve the CLI from the setting, then the server's toolchain, then (for the bundled server) `~/.beskid/bin/beskid` when it reports the same version and runtime ABI, then `PATH` when its version matches.
- Show `beskid test` failures, assertions and crashes, only at the `failure.location` that the CLI reports. The extension no longer searches project sources for the test declaration.
- `beskid.cli.path`, every `beskid.lsp.server.*` setting and `beskid.pckg.baseUrl` are machine-scoped: a workspace's `.vscode/settings.json` can no longer point VS Code at a binary or command of its choice, or send the registry key to another server. Set them in user settings.
- Remove only Beskid extension folders older than the running version. A newer version, or one whose order is not certain, is kept.
- The release bundle script reads `BESKID_RUNTIME_ABI_VERSION` from the compiler and stops when it is missing, cannot be parsed, or differs from `beskidToolchain.runtimeAbi`.
- Set the extension version to 0.6.7.

### Fixed

- Each task provider returns only tasks of its own type, which ends the VS Code log errors about tasks of another type.
- Start the CLI from an argument list without a shell, so a path with spaces or shell metacharacters reaches it unchanged on Windows.
- The `beskid-test` task closes once when the process fails to start, and closing its terminal stops the test process.

### Removed

- The **Beskid: Migrate Lock File** command (`beskid.migrateLock`). The language server no longer migrates an old `Project.lock`: it reports E3025, and the user deletes the file and writes a new lock.
- The `cli-stable` / `lsp-stable` downloads, **Install CLI**, **Install LSP**, **Setup Toolchain** and their settings. The extension never calls `beskid-up`.
- The `downloading` and `bootstrapping` runtime phases and their status labels.

### Security

- The extension no longer runs a `compiler/target/release/beskid_lsp` that it finds in or above a workspace folder. Use `beskid.lsp.server.path` or `beskid.lsp.server.devMode` for a local build.
- **Open report** opens only an `lsp-*.txt` file directly in `~/.beskid/crash`.

## [0.6.6] - 2026-10-16

### Changed

- Set the extension version to 0.6.6 to match the Beskid 0.6.6 toolchain.

## [0.6.0] - 2026-10-13

### Added

- Add standalone `.bsol` language registration backed by the same native LSP
  client, language configuration, and TextMate grammar as `.bproj` and `.bws`.
- Exercise completion and hover after incremental edits, diagnostic publication
  and clearing, and exact semantic-token ranges in a real VS Code extension host.

### Fixed

- Classify arbitrary BSOL block kinds and property keys instead of maintaining a
  manifest-only keyword list, and restrict fallback syntax to constructs the
  canonical BSOL parser accepts.
- Seed extension-host tests with an exact local LSP before activation so tests
  cannot race a managed download or a stale developer installation.
- Build standalone VS Code packages with an exact-version language server,
  reject package, lockfile, or binary version drift, and name VSIX artifacts by
  version and platform so stale packages cannot be mistaken for current ones.

### Changed

- Migrate to the Beskid 0.6 CLI command surface. The extension negotiates
  `beskid dev capabilities --json` before it runs the CLI, and rejects a CLI
  that fails the command or does not list the commands the extension uses, with
  upgrade guidance (`beskid toolchain update` or install Beskid 0.6). The
  `lsp --help` probes are removed.
- Set the extension version to 0.6.0 to match the Beskid 0.6 toolchain.
- Install the managed language server with
  `beskid dev lsp install --release-tag <tag>` from **Beskid: Install LSP** and
  first-launch setup, gated on capability negotiation, with CLI output and
  errors shown in the Beskid LSP output channel.
- Launch the CLI-hosted language server with `beskid dev lsp`, and run
  dependency fetch and lock with `beskid dev project fetch` and
  `beskid dev project lock`.
- Rename the `beskid.cli.analyze` command to `beskid.cli.check` and the
  `beskid-analyze` task type to `beskid-check`; both run `beskid check`.
- Pass `--project <bproj>` to project operations when a project manifest is
  focused, and accept a `.bproj` manifest as a task `projectPath`.
- Copy `beskid add <name>@<version>` for tool packages,
  `beskid package template install <name>` and
  `beskid new my-app --template <name>` for templates in the package registry.

- Prepare the extension package and lockfile identity for the corrected Beskid
  0.5.2 native release; verified replacement LSP payloads remain required before
  packaging or publication.
- Align the extension package and lockfile identity with the Beskid 0.5.1 release.
- Package platform-specific VSIX files from verified native release evidence
  without rebuilding the compiler; reject stale digests and mixed server payloads.
- Require clean, pinned editor source before manual release packaging.

- Replace extension and activity icons with Ridge and use the matching package-registry mark.

- Align the extension authoring and lockfile identity with the canonical Beskid
  0.4 toolchain version used by the Zed extension, CLI, and release pipeline.
- License the extension under Apache-2.0 and preserve notices for the bundled
  Mermaid dependency graph.
- Enable the Beskid language-server formatter automatically for Beskid source;
  manifests and standalone BSOL use semantic highlighting without advertising
  source-only formatting support.

### Removed

- Remove all invocations of retired 0.5 CLI spellings (`analyze`, `lsp`,
  `fetch`, `lock`, `pckg download`, `new install`). There is no fallback.
- Remove the extension's direct language-server download from GitHub
  releases; the CLI installs the language server.
