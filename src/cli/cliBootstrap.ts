import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import {
	readCliReleaseTag,
	readLspReleaseTag,
	resolveCliExecutablePath,
} from "../config/workspaceSettings.js";
import { cliSupportsLsp } from "./cliCapabilities.js";
import { appendToolchainFailure, formatToolchainError } from "./cliErrors.js";
import { type CliInstallResult, installBeskidCli } from "./cliInstall.js";
import { resolveCliPlatformAsset } from "./cliPlatform.js";
import { appendCliProcessLog, runCliProcess } from "./cliProcess.js";
import { discoverBootstrapProjects } from "./discoverBootstrapProjects.js";
import { installBeskidLsp, type LspInstallResult } from "./lspInstall.js";
import {
	defaultLspInstallPath,
	resolveLspPlatformAsset,
} from "./lspPlatform.js";

const BOOTSTRAP_STATE_KEY = "beskid.toolchain.bootstrapped";

export type ToolchainBootstrapProgress = {
	onDownloading?: () => void;
	onBootstrapping?: () => void;
};

export type CliBootstrapResult = {
	cliPath: string;
	installed: boolean;
	install?: CliInstallResult;
	lspPath?: string;
	lspInstalled: boolean;
	lspInstall?: LspInstallResult;
	fetchAttempted: boolean;
	fetchFailures: { project: string; exitCode: number }[];
};

import { readAutoFetchDependencies } from "../config/workspaceSettings.js";

async function verifyCliSupportsLsp(
	cliPath: string,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	outputChannel.appendLine(
		`[Beskid toolchain] Verifying ${cliPath} supports 'lsp'…`,
	);
	const result = await runCliProcess(cliPath, ["lsp", "--help"]);
	appendCliProcessLog(
		outputChannel,
		cliPath,
		["lsp", "--help"],
		undefined,
		result,
	);
	if (!(await cliSupportsLsp(cliPath))) {
		throw new Error(
			`Installed CLI does not support 'beskid lsp' (exit ${result.exitCode}). ` +
				"Download a current CLI release (default tag: cli-stable) or point beskid.cli.path at a local build.",
		);
	}
}

async function runProjectFetch(
	cliPath: string,
	projectUri: vscode.Uri,
	outputChannel: vscode.OutputChannel,
): Promise<number> {
	const manifest = projectUri.fsPath;
	const cwd = dirname(manifest);
	outputChannel.appendLine(
		`[Beskid toolchain] Fetching dependencies for ${manifest}`,
	);
	const result = await runCliProcess(cliPath, ["fetch", "--project", manifest], {
		cwd,
	});
	appendCliProcessLog(
		outputChannel,
		cliPath,
		["fetch", "--project", manifest],
		cwd,
		result,
	);
	return result.exitCode;
}

async function fetchWorkspaceDependencies(
	cliPath: string,
	outputChannel: vscode.OutputChannel,
): Promise<{
	attempted: boolean;
	failures: { project: string; exitCode: number }[];
}> {
	const projects = await discoverBootstrapProjects();
	if (projects.length === 0) {
		outputChannel.appendLine(
			"[Beskid toolchain] No .bws or .bproj manifest found in open folders; skipping fetch.",
		);
		return { attempted: false, failures: [] };
	}

	const failures: { project: string; exitCode: number }[] = [];
	for (const project of projects) {
		const exitCode = await runProjectFetch(cliPath, project, outputChannel);
		if (exitCode !== 0) {
			failures.push({ project: project.fsPath, exitCode });
		}
	}
	return { attempted: true, failures };
}

async function installManagedCli(
	outputChannel: vscode.OutputChannel,
	releaseTag: string,
): Promise<CliInstallResult> {
	const asset = resolveCliPlatformAsset();
	outputChannel.appendLine(
		"[Beskid toolchain] Installing CLI from GitHub release…",
	);
	outputChannel.appendLine(`  release tag: ${releaseTag}`);
	outputChannel.appendLine(`  platform: ${process.platform}-${process.arch}`);
	if (asset) {
		outputChannel.appendLine(`  asset: ${asset.releaseAsset}`);
	}
	outputChannel.show(true);
	return installBeskidCli(outputChannel, releaseTag);
}

async function installManagedLsp(
	outputChannel: vscode.OutputChannel,
	releaseTag: string,
): Promise<LspInstallResult> {
	const asset = resolveLspPlatformAsset();
	outputChannel.appendLine(
		"[Beskid toolchain] Installing LSP from GitHub release…",
	);
	outputChannel.appendLine(`  release tag: ${releaseTag}`);
	outputChannel.appendLine(`  platform: ${process.platform}-${process.arch}`);
	if (asset) {
		outputChannel.appendLine(`  asset: ${asset.releaseAsset}`);
	}
	outputChannel.show(true);
	return installBeskidLsp(outputChannel, releaseTag);
}

/**
 * Ensures managed CLI and LSP binaries (GitHub `cli-stable` / `lsp-stable` by default),
 * optionally fetches workspace dependencies once, and verifies the toolchain before LSP starts.
 */
export async function bootstrapBeskidToolchain(
	context: ExtensionContext,
	outputChannel: vscode.OutputChannel,
	progress?: ToolchainBootstrapProgress,
): Promise<CliBootstrapResult> {
	const cliReleaseTag = readCliReleaseTag();
	const lspReleaseTag = readLspReleaseTag();
	let cliPath = resolveCliExecutablePath();
	let installed = false;
	let install: CliInstallResult | undefined;
	let lspInstalled = false;
	let lspInstall: LspInstallResult | undefined;
	const lspPath = defaultLspInstallPath();

	try {
		if (!cliPath) {
			progress?.onDownloading?.();
			install = await installManagedCli(outputChannel, cliReleaseTag);
			cliPath = install.path;
			installed = true;
			outputChannel.appendLine(
				`[Beskid toolchain] Installed Beskid CLI ${install.version} → ${install.path}`,
			);
		} else if (!(await cliSupportsLsp(cliPath))) {
			progress?.onDownloading?.();
			outputChannel.appendLine(
				`[Beskid toolchain] CLI at ${cliPath} is too old for 'beskid lsp'; upgrading from ${cliReleaseTag}…`,
			);
			install = await installManagedCli(outputChannel, cliReleaseTag);
			cliPath = install.path;
			installed = true;
			outputChannel.appendLine(
				`[Beskid toolchain] Upgraded Beskid CLI to ${install.version} → ${install.path}`,
			);
		} else {
			outputChannel.appendLine(`[Beskid toolchain] Using CLI at ${cliPath}`);
		}

		if (!existsSync(cliPath)) {
			throw new Error(`CLI path does not exist: ${cliPath}`);
		}

		if (!existsSync(lspPath)) {
			progress?.onDownloading?.();
			lspInstall = await installManagedLsp(outputChannel, lspReleaseTag);
			lspInstalled = true;
			outputChannel.appendLine(
				`[Beskid toolchain] Installed Beskid LSP ${lspInstall.version} → ${lspInstall.path}`,
			);
		} else {
			outputChannel.appendLine(`[Beskid toolchain] Using LSP at ${lspPath}`);
		}

		const verifiedCliPath = context.globalState.get<string>(
			"beskid.toolchain.verifiedCliPath",
		);
		const hasManagedLsp = existsSync(lspPath);
		if (!hasManagedLsp && verifiedCliPath !== cliPath) {
			await verifyCliSupportsLsp(cliPath, outputChannel);
			await context.globalState.update(
				"beskid.toolchain.verifiedCliPath",
				cliPath,
			);
		} else if (hasManagedLsp) {
			outputChannel.appendLine(
				"[Beskid toolchain] Managed LSP present; skipping CLI 'lsp' probe.",
			);
		}

		let fetchAttempted = false;
		const fetchFailures: { project: string; exitCode: number }[] = [];
		const alreadyBootstrapped = context.globalState.get<boolean>(
			BOOTSTRAP_STATE_KEY,
			false,
		);
		const autoFetch = readAutoFetchDependencies();

		if (autoFetch && !alreadyBootstrapped) {
			progress?.onBootstrapping?.();
			const fetchResult = await fetchWorkspaceDependencies(cliPath, outputChannel);
			fetchAttempted = fetchResult.attempted;
			fetchFailures.push(...fetchResult.failures);

			if (fetchFailures.length === 0) {
				await context.globalState.update(BOOTSTRAP_STATE_KEY, true);
			} else {
				const summary = fetchFailures
					.map((f) => `${f.project} (exit ${f.exitCode})`)
					.join("; ");
				const detail = formatToolchainError(
					"Dependency fetch",
					new Error(summary),
					{
						"CLI release tag": cliReleaseTag,
						"LSP release tag": lspReleaseTag,
						cli: cliPath,
					},
				);
				outputChannel.appendLine(detail);
				void vscode.window
					.showErrorMessage(
						"Beskid could not fetch all project dependencies. See the Beskid LSP output for details.",
						"Open Output",
					)
					.then((choice) => {
						if (choice === "Open Output") {
							outputChannel.show(true);
						}
					});
			}
		} else if (!autoFetch) {
			outputChannel.appendLine(
				"[Beskid toolchain] autoFetchDependencies disabled; skipping fetch.",
			);
		} else {
			outputChannel.appendLine(
				"[Beskid toolchain] Dependencies already bootstrapped; skipping fetch.",
			);
		}

		return {
			cliPath,
			installed,
			install,
			lspPath: existsSync(lspPath) ? lspPath : lspInstall?.path,
			lspInstalled,
			lspInstall,
			fetchAttempted,
			fetchFailures,
		};
	} catch (error) {
		const cliAsset = resolveCliPlatformAsset();
		const lspAsset = resolveLspPlatformAsset();
		const detail = appendToolchainFailure(
			outputChannel,
			"Toolchain bootstrap",
			error,
			{
				"CLI release tag": cliReleaseTag,
				"LSP release tag": lspReleaseTag,
				platform: `${process.platform}-${process.arch}`,
				"CLI asset": cliAsset?.releaseAsset,
				"LSP asset": lspAsset?.releaseAsset,
			},
		);
		void vscode.window
			.showErrorMessage(
				"Beskid toolchain setup failed. See the Beskid LSP output for details.",
				"Open Output",
			)
			.then((choice) => {
				if (choice === "Open Output") {
					outputChannel.show(true);
				}
			});
		throw new Error(detail);
	}
}
