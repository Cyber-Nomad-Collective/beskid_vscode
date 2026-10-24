import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import {
	bundledPlatformArchKeys,
	resolveBundledServerBinaryAt,
} from "../lsp/serverBinary.js";
import { negotiateCliCapabilities } from "./cliCapabilities.js";
import {
	applyRemovalPlan,
	describeRemovalPlan,
	planStaleRemoval,
} from "./toolchainRemoval.js";
import {
	type CliSelection,
	type ServerSelection,
	selectCli,
	selectServer,
	staleToolchainMessage,
	type ToolchainDeps,
	type ToolchainIdentity,
} from "./toolchainSelection.js";

export const REMOVE_STALE_COMMAND = "beskid.toolchain.removeStale";
const REMOVE_STALE_LABEL = "Remove stale toolchain";

let extensionContext: vscode.ExtensionContext | undefined;
let warnedSignature: string | undefined;

export function setToolchainContext(context: vscode.ExtensionContext): void {
	extensionContext = context;
}

/** The toolchain this extension was built against: its version and the runtime ABI in package.json. */
export function expectedToolchain(
	context: vscode.ExtensionContext,
): ToolchainIdentity {
	const json = context.extension.packageJSON as {
		version?: string;
		beskidToolchain?: { runtimeAbi?: number };
	};
	return {
		version: json.version ?? "0.0.0",
		runtimeAbi: json.beskidToolchain?.runtimeAbi,
	};
}

export const managedToolchainDir = (): string => join(homedir(), ".beskid", "bin");

function liveDeps(): ToolchainDeps {
	return {
		exists: existsSync,
		probe: async (cliPath) => {
			const result = await negotiateCliCapabilities(cliPath);
			return result.compatible
				? {
						version: result.document.cliVersion,
						runtimeAbi: result.document.runtimeAbi,
					}
				: undefined;
		},
	};
}

function explicitServerPath(): string | undefined {
	const value = vscode.workspace
		.getConfiguration("beskid.lsp")
		.get<string>("server.path", "")
		.trim();
	return value.length > 0 ? value : undefined;
}

function explicitCliPath(): string | undefined {
	const value = (
		vscode.workspace.getConfiguration("beskid").get<string>("cli.path", "") ?? ""
	).trim();
	return value.length > 0 && value !== "beskid" ? value : undefined;
}

export async function resolveServerSelection(
	context: vscode.ExtensionContext,
): Promise<ServerSelection> {
	const selection = await selectServer(
		{
			expected: expectedToolchain(context),
			explicitServerPath: explicitServerPath(),
			bundledServerPath: resolveBundledServerBinaryAt(
				context.extensionPath,
				bundledPlatformArchKeys(),
			),
			managedDir: managedToolchainDir(),
			platform: process.platform,
		},
		liveDeps(),
	);
	warnAboutStaleToolchain(context, selection);
	return selection;
}

/** Resolves the CLI to run; `undefined` with a reason when none matches the extension's toolchain. */
export async function resolveCli(): Promise<CliSelection> {
	const context = extensionContext;
	if (!context) {
		return { source: "none", reason: "The Beskid extension is not active." };
	}
	const server = await selectServer(
		{
			expected: expectedToolchain(context),
			explicitServerPath: explicitServerPath(),
			bundledServerPath: resolveBundledServerBinaryAt(
				context.extensionPath,
				bundledPlatformArchKeys(),
			),
			managedDir: managedToolchainDir(),
			platform: process.platform,
		},
		liveDeps(),
	);
	return selectCli(
		{
			expected: expectedToolchain(context),
			explicitCliPath: explicitCliPath(),
			server,
			pathCommand: "beskid",
		},
		liveDeps(),
	);
}

function warnAboutStaleToolchain(
	context: vscode.ExtensionContext,
	selection: ServerSelection,
): void {
	if (!selection.stale) {
		return;
	}
	const message = staleToolchainMessage(selection.stale, expectedToolchain(context));
	if (warnedSignature === message) {
		return;
	}
	warnedSignature = message;
	void vscode.window
		.showWarningMessage(message, REMOVE_STALE_LABEL)
		.then((choice) => {
			if (choice === REMOVE_STALE_LABEL) {
				void vscode.commands.executeCommand(REMOVE_STALE_COMMAND);
			}
		});
}

export function registerToolchainCommands(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): void {
	setToolchainContext(context);
	context.subscriptions.push(
		vscode.commands.registerCommand(REMOVE_STALE_COMMAND, async () => {
			const selection = await resolveServerSelection(context);
			const plan = planStaleRemoval(
				selection,
				dirname(context.extensionPath),
				expectedToolchain(context).version,
			);
			if (plan.files.length === 0 && plan.folders.length === 0) {
				void vscode.window.showInformationMessage(
					"No stale Beskid toolchain or old extension folders found.",
				);
				return;
			}
			const choice = await vscode.window.showWarningMessage(
				"Remove these paths?",
				{ modal: true, detail: describeRemovalPlan(plan) },
				"Remove",
			);
			if (choice !== "Remove") {
				return;
			}
			applyRemovalPlan(plan);
			outputChannel.appendLine(
				`[Beskid toolchain] Removed:\n${describeRemovalPlan(plan)}`,
			);
			warnedSignature = undefined;
			void vscode.window.showInformationMessage(
				"Removed. Reload the window to finish removing old extension versions.",
			);
		}),
	);
}
