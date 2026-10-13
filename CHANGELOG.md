# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
