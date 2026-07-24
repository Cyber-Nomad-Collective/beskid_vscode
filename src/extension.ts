import type { ExtensionContext } from "vscode";
import { ExtensionServices } from "./core/ExtensionServices.js";

let services: ExtensionServices | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
	services = ExtensionServices.create(context);
	await services.activate();
}

export async function deactivate(): Promise<void> {
	if (services) {
		await services.deactivate();
		services = undefined;
	}
}
