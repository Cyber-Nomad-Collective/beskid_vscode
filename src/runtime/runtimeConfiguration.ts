import * as vscode from "vscode";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { BeskidLspSession } from "./BeskidLspSession.js";
import type { LspRuntimeState } from "./LspRuntimeState.js";

/** Full LSP process restart when the server binary or launch mode changes. */
const LSP_RESTART_KEYS = [
  "beskid.lsp.server.path",
  "beskid.lsp.server.devMode",
  "beskid.lsp.server.preferBundled",
  "beskid.cli.path",
  "beskid.cli.releaseTag",
] as const;

export function registerRuntimeConfiguration(
  context: vscode.ExtensionContext,
  deps: {
    session: BeskidLspSession;
    packageProvider: PackageManagerProvider;
    runtime: LspRuntimeState;
  },
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration("beskid") || event.affectsConfiguration("beskid.lsp")) {
        deps.runtime.refreshSettings();
      }
      if (LSP_RESTART_KEYS.some((key) => event.affectsConfiguration(key))) {
        await deps.session.restart();
        return;
      }
      if (event.affectsConfiguration("beskid.pckg.baseUrl")) {
        deps.packageProvider.refresh();
      }
    }),
  );
}
