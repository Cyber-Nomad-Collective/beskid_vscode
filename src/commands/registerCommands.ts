import type { ExtensionContext } from "vscode";
import type { ExtensionServices } from "../core/ExtensionServices.js";
import { registerExplorerCommands } from "./explorerCommands.js";
import { registerLspCommands } from "./lspCommands.js";
import { registerPackageCommands } from "./packageCommands.js";

export function registerCommands(context: ExtensionContext, services: ExtensionServices): void {
  registerLspCommands(context, services.outputChannel, services.session, () =>
    services.showQuickActions(),
  );
  registerPackageCommands(context, {
    packageProvider: services.packageProvider,
    refresh: services.refresh,
  });
  registerExplorerCommands(context, {
    focus: services.focus,
    session: services.session,
    refresh: services.refresh,
    views: services.views,
    workspaceTree: services.workspaceTree,
    projectTree: services.projectTree,
    packageProvider: services.packageProvider,
  });
}
