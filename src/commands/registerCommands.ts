import type { ExtensionContext } from "vscode";
import type { ExtensionServices } from "../core/ExtensionServices.js";
import { registerGraphCommands } from "./graphCommands.js";
import { registerExplorerCommands } from "./explorerCommands.js";
import { registerLspCommands } from "./lspCommands.js";
import { registerPackageCommands } from "./packageCommands.js";
import { registerSymbolCommands } from "./symbolCommands.js";

export function registerCommands(context: ExtensionContext, services: ExtensionServices): void {
  registerLspCommands(context, services.outputChannel, services.session, () =>
    services.showQuickActions(),
  );
  registerPackageCommands(context, {
    packageProvider: services.packageProvider,
    pckg: services.pckg,
    refresh: services.refresh,
    openRegistryPanel: () => services.registryPanel.open(),
  });
  registerSymbolCommands(context, () => services.session.getClient());
  registerExplorerCommands(context, {
    focus: services.focus,
    session: services.session,
    refresh: services.refresh,
    views: services.views,
    projectsTree: services.projectsTree,
  });
  registerGraphCommands(context, services.graphPanel);
}
