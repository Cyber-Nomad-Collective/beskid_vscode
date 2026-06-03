import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Mirrors LSP `PROJECT_EXPLORER_COMMANDS` — update when server contract changes. */
export const PROJECT_EXPLORER_COMMANDS = [
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

  test("extension does not manually register LSP execute commands", () => {
    const registrationSources = [
      "src/commands/explorerCommands.ts",
      "src/commands/graphCommands.ts",
      "src/commands/lspCommands.ts",
      "src/commands/packageCommands.ts",
      "src/commands/symbolCommands.ts",
      "src/cli/cliService.ts",
      "src/packages/PackageRegistryPanel.ts",
      "src/activation/registerRuntimeUi.ts",
      "src/dashboard/BeskidModalPanel.ts",
    ];
    for (const relativePath of registrationSources) {
      const source = readFileSync(join(import.meta.dirname, "..", relativePath), "utf8");
      for (const command of PROJECT_EXPLORER_COMMANDS) {
        expect(source).not.toContain(`registerCommand("${command}"`);
      }
    }
  });
});
