import type { ExtensionContext } from "vscode";
import type { ExtensionServices } from "../core/ExtensionServices.js";
import { registerCoreExplorerCommands } from "./explorerCommands.js";
import { registerLspCommands } from "./lspCommands.js";

/** Register commands that must exist before tree views become interactive. */
export function registerCoreCommands(context: ExtensionContext, services: ExtensionServices): void {
  registerLspCommands(context, services.outputChannel, services.session, () =>
    services.showQuickActions(),
  );
  registerCoreExplorerCommands(context, {
    focus: services.focus,
    session: services.session,
    refresh: services.refresh,
  });
}
