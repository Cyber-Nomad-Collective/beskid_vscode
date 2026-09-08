# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Build standalone VS Code packages with an exact-version language server,
  reject package, lockfile, or binary version drift, and name VSIX artifacts by
  version and platform so stale packages cannot be mistaken for current ones.

### Changed

- Align the extension authoring and lockfile identity with the canonical Beskid
  0.4 toolchain version used by the Zed extension, CLI, and release pipeline.
- License the extension under Apache-2.0 and preserve notices for the bundled
  Mermaid dependency graph.
- Enable the Beskid language-server formatter automatically when saving Beskid source and manifest files.
