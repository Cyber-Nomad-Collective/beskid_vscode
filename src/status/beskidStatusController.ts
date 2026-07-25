import type * as vscode from "vscode";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";
import type { LspRuntimeSnapshot } from "../runtime/lspRuntimeTypes.js";
import { toBeskidStatusSnapshot } from "../runtime/runtimeSnapshotMapping.js";
import { deriveBeskidStatusPresentation } from "./beskidStatusPresentation.js";

export class BeskidStatusController {
	private subscription: vscode.Disposable | undefined;

	constructor(
		private readonly statusBar: vscode.StatusBarItem,
		readonly runtime: LspRuntimeState,
	) {
		this.subscription = runtime.onDidChange((snapshot) => this.render(snapshot));
		this.render(runtime.getSnapshot());
	}

	dispose(): void {
		this.subscription?.dispose();
		this.subscription = undefined;
	}

	private render(runtimeSnapshot: LspRuntimeSnapshot): void {
		const { text, tooltipLines } = deriveBeskidStatusPresentation(
			toBeskidStatusSnapshot(runtimeSnapshot),
		);
		this.statusBar.text = text;
		const lines = [
			"Open Beskid dashboard (click)",
			`LSP: ${runtimeSnapshot.phase}`,
			...tooltipLines.slice(1),
		];
		if (runtimeSnapshot.detail) {
			lines.push(runtimeSnapshot.detail);
		}
		if (runtimeSnapshot.launch?.binaryPath) {
			lines.push(`Binary: ${runtimeSnapshot.launch.binaryPath}`);
		}
		if (runtimeSnapshot.error) {
			lines.push(runtimeSnapshot.error);
		}
		this.statusBar.tooltip = lines.join("\n");
	}
}
