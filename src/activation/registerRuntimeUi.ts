import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { BeskidModalPanel } from "../dashboard/BeskidModalPanel.js";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";

export type RuntimeUiHandles = {
	modal: BeskidModalPanel;
};

export function registerRuntimeUi(
	context: ExtensionContext,
	runtime: LspRuntimeState,
	extensionVersion: string,
): RuntimeUiHandles {
	const modal = new BeskidModalPanel(runtime, extensionVersion);
	modal.register(context);

	context.subscriptions.push(
		vscode.commands.registerCommand("beskid.debug.focus", async () => {
			const enabled = vscode.workspace
				.getConfiguration("beskid")
				.get<boolean>("debug.enabled", false);
			if (!enabled) {
				void vscode.window.showInformationMessage(
					"Enable beskid.debug.enabled in settings to use the Debug view.",
				);
				return;
			}
			await vscode.commands.executeCommand("beskidDebugView.focus");
		}),
	);

	return { modal };
}
