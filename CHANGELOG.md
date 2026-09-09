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

- Align the extension authoring and lockfile identity with the canonical Beskid
  0.4 toolchain version used by the Zed extension, CLI, and release pipeline.
- License the extension under Apache-2.0 and preserve notices for the bundled
  Mermaid dependency graph.
- Enable the Beskid language-server formatter automatically for Beskid source;
  manifests and standalone BSOL use semantic highlighting without advertising
  source-only formatting support.
