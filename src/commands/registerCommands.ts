import type { ExtensionContext } from "vscode";
import type { ExtensionServices } from "../core/ExtensionServices.js";
import { registerDeferredExplorerCommands } from "./explorerCommands.js";
import { registerGraphCommands } from "./graphCommands.js";
import { registerPackageCommands } from "./packageCommands.js";
import { registerSymbolCommands } from "./symbolCommands.js";

export function registerCommands(
	context: ExtensionContext,
	services: ExtensionServices,
): void {
	registerPackageCommands(context, {
		packageProvider: services.packageProvider,
		pckg: services.pckg,
		refresh: services.refresh,
		openRegistryPanel: () => services.registryPanel.open(),
	});
	registerSymbolCommands(
		context,
		() => services.session.getClient(),
		services.outputChannel,
	);
	registerDeferredExplorerCommands(context, {
		focus: services.focus,
		session: services.session,
		refresh: services.refresh,
		views: services.views,
		projectsTree: services.projectsTree,
	});
	registerGraphCommands(context, services.graphPanel);
}
