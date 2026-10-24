import { spawn } from "node:child_process";
import { dirname } from "node:path";
import * as vscode from "vscode";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";
import { describeIncompatibility, negotiateCliCapabilities } from "./cliCapabilities.js";
import { resolveCli } from "./toolchain.js";
import {
	type BeskidCliOperation,
	cliOperationArgs,
	cliOperationLabel,
	isProjectManifestPath,
} from "./cliCommandSurface.js";

export type { BeskidCliOperation } from "./cliCommandSurface.js";

export type CliRunPhase = BeskidCliOperation;

export type CliRunOptions = {
	subcommand: CliRunPhase;
	projectUri?: vscode.Uri;
	extraArgs?: string[];
	onPhase?: (
		phase: BeskidActivityPhase,
		active: boolean,
		detail?: string,
	) => void;
};

export function focusedProjectCwd(
	projectUri: vscode.Uri | undefined,
): string | undefined {
	if (!projectUri) {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}
	return dirname(projectUri.fsPath);
}

function projectRoot(projectUri: vscode.Uri | undefined): string | undefined {
	return focusedProjectCwd(projectUri);
}

function showCliNotFound(reason: string): void {
	void vscode.window
		.showErrorMessage(
			`${reason} Set \`beskid.cli.path\`, or install the extension build that bundles the toolchain.`,
			"Open settings",
			"Remove stale toolchain",
		)
		.then((choice) => {
			if (choice === "Open settings") {
				void vscode.commands.executeCommand(
					"workbench.action.openSettings",
					"beskid.cli.path",
				);
			} else if (choice === "Remove stale toolchain") {
				void vscode.commands.executeCommand("beskid.toolchain.removeStale");
			}
		});
}

export async function runBeskidCli(
	outputChannel: vscode.OutputChannel,
	options: CliRunOptions,
): Promise<number> {
	const cwd = projectRoot(options.projectUri);
	if (!cwd) {
		void vscode.window.showWarningMessage("No project root for Beskid CLI.");
		return 1;
	}
	const selected = await resolveCli();
	if (selected.source === "none") {
		outputChannel.appendLine(`[Beskid CLI] ${selected.reason}`);
		showCliNotFound(selected.reason);
		return 1;
	}
	const cli = selected.cliPath;
	const compatibility = await negotiateCliCapabilities(cli);
	if (!compatibility.compatible) {
		outputChannel.appendLine(
			`[Beskid CLI] ${describeIncompatibility(compatibility)}`,
		);
		outputChannel.show(true);
		void vscode.window
			.showErrorMessage(compatibility.guidance, "Open settings")
			.then((choice) => {
				if (choice === "Open settings") {
					void vscode.commands.executeCommand(
						"workbench.action.openSettings",
						"beskid.cli.path",
					);
				}
			});
		return 1;
	}
	const manifest = isProjectManifestPath(options.projectUri?.fsPath)
		? options.projectUri?.fsPath
		: undefined;
	const args = cliOperationArgs(
		options.subcommand,
		manifest,
		options.extraArgs ?? [],
	);
	const label = cliOperationLabel(options.subcommand);
	options.onPhase?.(options.subcommand, true, `${cli} ${label}…`);
	outputChannel.appendLine(`$ ${cli} ${args.join(" ")} (cwd: ${cwd})`);
	outputChannel.show(true);

	return new Promise((resolve) => {
		const child = spawn(cli, args, {
			cwd,
			shell: process.platform === "win32",
		});
		child.stdout.on("data", (chunk: Buffer) =>
			outputChannel.append(chunk.toString()),
		);
		child.stderr.on("data", (chunk: Buffer) =>
			outputChannel.append(chunk.toString()),
		);
		child.on("close", (code) => {
			options.onPhase?.(options.subcommand, false);
			const exitCode = code ?? 1;
			if (exitCode !== 0) {
				outputChannel.appendLine(
					`[Beskid CLI] ${label} failed with exit code ${exitCode}. See output above.`,
				);
				outputChannel.show(true);
				void vscode.window
					.showErrorMessage(
						`Beskid ${label} failed (exit ${exitCode}). See Beskid LSP output for details.`,
						"Open Output",
					)
					.then((choice) => {
						if (choice === "Open Output") {
							outputChannel.show(true);
						}
					});
			} else {
				void vscode.window.showInformationMessage(
					`Beskid ${label} completed.`,
				);
			}
			resolve(exitCode);
		});
		child.on("error", (err) => {
			options.onPhase?.(options.subcommand, false);
			outputChannel.appendLine(String(err));
			const errno = err as NodeJS.ErrnoException;
			if (errno.code === "ENOENT") {
				showCliNotFound(`Beskid CLI ${cli} could not be started.`);
			} else {
				void vscode.window.showErrorMessage(
					`Failed to run Beskid CLI: ${err.message}`,
				);
			}
			resolve(1);
		});
	});
}

/** Registry base URL: workspace `default` registry from LSP summary → `beskid.pckg.baseUrl` → localhost. */
export async function resolveRegistryBaseUrl(
	lspGetSummary: (
		workspaceUri: string,
	) => Promise<{ registries: Record<string, string> } | undefined>,
	workspaceProjUri: string | undefined,
	fallback: () => string,
): Promise<string> {
	if (workspaceProjUri) {
		const summary = await lspGetSummary(workspaceProjUri);
		const defaultRegistry = summary?.registries?.default?.trim();
		if (defaultRegistry) {
			return defaultRegistry.replace(/\/$/, "");
		}
	}
	return fallback().replace(/\/$/, "");
}
