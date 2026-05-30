import { describe, expect, test } from "bun:test";

/** Mirrors LSP `PROJECT_EXPLORER_COMMANDS` — update when server contract changes. */
const PROJECT_EXPLORER_COMMANDS = [
  "beskid.refreshWorkspace",
  "beskid.listWorkspaces",
  "beskid.getWorkspaceSummary",
  "beskid.getGraph",
  "beskid.getProjectDependencies",
  "beskid.pckg.getConnectionStatus",
  "beskid.pckg.setRegistry",
  "beskid.pckg.validateConnection",
  "beskid.symbol.getDocumentationUri",
] as const;

/** Planned pckg execute commands (see `beskid_lsp::pckg_connection_contract`). */
const PCKG_EXECUTE_COMMANDS = [
  "beskid.pckg.getConnectionStatus",
  "beskid.pckg.setRegistry",
  "beskid.pckg.validateConnection",
] as const;

describe("LSP execute command contracts", () => {
  test("explorer commands are unique", () => {
    expect(new Set(PROJECT_EXPLORER_COMMANDS).size).toBe(PROJECT_EXPLORER_COMMANDS.length);
  });

  test("pckg commands are namespaced and advertised with explorer commands", () => {
    for (const cmd of PCKG_EXECUTE_COMMANDS) {
      expect(cmd.startsWith("beskid.pckg.")).toBe(true);
      expect(PROJECT_EXPLORER_COMMANDS.includes(cmd as (typeof PROJECT_EXPLORER_COMMANDS)[number])).toBe(
        true,
      );
    }
  });
});
