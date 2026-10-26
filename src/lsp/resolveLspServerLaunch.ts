import { dirname } from "node:path";
import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { Executable } from "vscode-languageclient/node";
import { resolveServerSelection } from "../cli/toolchain.js";
import { lspDocumentationEnv } from "../config/workspaceSettings.js";
import { planLspLaunch } from "./lspLaunchPlan.js";
import { platformArchKey } from "./serverBinary.js";

function serverCwd(selectedProjectUri: vscode.Uri | undefined): {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
} {
	const config = vscode.workspace.getConfiguration("beskid.lsp");
	const configuredCwd = config.get<string>("server.cwd", "").trim();
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	const projectRoot = selectedProjectUri
		? dirname(selectedProjectUri.fsPath)
		: undefined;
	const cwd =
		configuredCwd.length > 0 ? configuredCwd : (projectRoot ?? workspaceRoot);
	const env = { ...process.env, ...lspDocumentationEnv() };
	return cwd ? { cwd, env } : { env };
}

function executable(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv },
): Executable {
	return { command, args, options };
}

function sameLaunch(launch: Executable): {
	run: Executable;
	debug: Executable;
} {
	return { run: launch, debug: launch };
}

export async function resolveLspServerLaunch(
	context: ExtensionContext,
	selectedProjectUri: vscode.Uri | undefined,
): Promise<{ run: Executable; debug: Executable }> {
	const config = vscode.workspace.getConfiguration("beskid.lsp");
	const options = serverCwd(selectedProjectUri);
	const devMode = config.get<boolean>("server.devMode", false);

	// Explicit setting, then the bundled server, then a matching ~/.beskid/bin.
	// Nothing is downloaded and `beskid-up` is never called.
	const plan = planLspLaunch(await resolveServerSelection(context), devMode);
	if (plan.kind === "binary") {
		return sameLaunch(executable(plan.serverPath, [], options));
	}
	if (plan.kind === "none") {
		const platformKey =
			platformArchKey() ?? `${process.platform}-${process.arch}`;
		const message =
			`Beskid language server could not be started for ${platformKey}: ` +
			"this extension has no bundled server for it and no matching toolchain in ~/.beskid/bin. " +
			"Install the extension build for your platform, set `beskid.lsp.server.path`, " +
			"or enable `beskid.lsp.server.devMode`.";
		void vscode.window.showErrorMessage(message);
		throw new Error(message);
	}

	const command = config.get<string>("server.command", "cargo");
	const args = config.get<string[]>("server.args", ["run", "-p", "beskid_lsp"]);
	const debugArgs = config.get<string[]>("server.debugArgs", [
		"run",
		"-p",
		"beskid_lsp",
	]);
	return {
		run: executable(command, args, options),
		debug: executable(command, debugArgs, options),
	};
}
