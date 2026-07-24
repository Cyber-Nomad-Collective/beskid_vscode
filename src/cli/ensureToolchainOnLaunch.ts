import { existsSync } from "node:fs";
import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import {
	readAutoFetchDependencies,
	resolveCliExecutablePath,
} from "../config/workspaceSettings.js";
import { cliSupportsLsp } from "./cliCapabilities.js";
import { defaultLspInstallPath } from "./lspPlatform.js";
import {
	onboardingProgressMessage,
	type ToolchainAssessment,
} from "./toolchainAssessment.js";

export type { ToolchainAssessment };
export { onboardingProgressMessage };

const BOOTSTRAP_STATE_KEY = "beskid.toolchain.bootstrapped";

/** True when the extension should download managed CLI/LSP on activate. */
export function shouldAutoInstallToolchainOnLaunch(): boolean {
	const beskid = vscode.workspace.getConfiguration("beskid");
	if (!beskid.get<boolean>("toolchain.autoInstallOnLaunch", true)) {
		return false;
	}

	const lsp = vscode.workspace.getConfiguration("beskid.lsp");
	if (lsp.get<boolean>("server.devMode", false)) {
		return false;
	}
	if (lsp.get<string>("server.path", "").trim().length > 0) {
		return false;
	}

	return true;
}

export async function assessToolchainNeeds(
	context: ExtensionContext,
): Promise<ToolchainAssessment> {
	const cliPath = resolveCliExecutablePath();
	const lspPath = defaultLspInstallPath();
	const lspMissing = !existsSync(lspPath);
	const cliMissing = !cliPath;
	let cliNeedsUpgrade = false;
	if (cliPath && lspMissing) {
		cliNeedsUpgrade = !(await cliSupportsLsp(cliPath));
	}

	const downloading = cliMissing || lspMissing || cliNeedsUpgrade;
	const autoFetch = readAutoFetchDependencies();
	const alreadyBootstrapped = context.globalState.get<boolean>(
		BOOTSTRAP_STATE_KEY,
		false,
	);
	const needsFetch = autoFetch && !alreadyBootstrapped;

	return {
		requiresBootstrap: downloading || needsFetch,
		downloading,
		cliMissing,
		cliNeedsUpgrade,
		lspMissing,
		needsFetch,
	};
}
