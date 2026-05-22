import * as vscode from "vscode";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { BeskidLspSession } from "./BeskidLspSession.js";

/** Full LSP process restart only when the server binary or launch mode changes. */
const LSP_RESTART_KEYS = ["beskid.lsp.server.path", "beskid.lsp.server.devMode"] as const;

export function registerRuntimeConfiguration(
  context: vscode.ExtensionContext,
  deps: {
    session: BeskidLspSession;
    packageProvider: PackageManagerProvider;
  },
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
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
