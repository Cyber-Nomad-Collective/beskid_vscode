# Superrepo manual smoke (VS Code ↔ LSP boundary)

Run after `just replace` in `compiler/` and reloading the VS Code window on the superrepo root.

1. Open **Beskid LSP** output — confirm no crash loop or repeated server restarts.
2. **Projects** sidebar lists `.bws` workspaces and member projects with non-empty member URIs.
3. Expand a member **Targets** and **Dependencies** — data loads or shows an explicit warning node (not a silent empty section).
4. Run **Beskid: Focus Project** from the command palette and from a member context menu.
5. Run **Beskid: Restart Language Server** — focused project and Projects tree repopulate after restart.
6. Execute-command failures appear in **Beskid LSP** output with the command name.

Automated gates: `scripts/ci/verify-lsp-command-contract.sh`, `bun test`, `bun run test:integration`, and `cargo test -p beskid_lsp`.
