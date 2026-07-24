import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";
import {
	type BeskidCliSubcommand,
	focusedProjectCwd,
	runBeskidCli,
} from "./beskidCliRunner.js";
import type { ToolchainBootstrapProgress } from "./cliBootstrap.js";
import { bootstrapBeskidToolchain } from "./cliBootstrap.js";
import { installBeskidCli } from "./cliInstall.js";
import { installBeskidLsp } from "./lspInstall.js";

export type CliServiceOptions = {
	context: ExtensionContext;
	outputChannel: vscode.OutputChannel;
	getFocusedProjectUri: () => vscode.Uri | undefined;
	onPhase?: (
		phase: BeskidActivityPhase,
		active: boolean,
		detail?: string,
	) => void;
};

export class CliService {
	constructor(private readonly options: CliServiceOptions) {}

	async run(
		subcommand: BeskidCliSubcommand,
		extraArgs?: string[],
	): Promise<number> {
		return runBeskidCli(this.options.outputChannel, {
			subcommand,
			projectUri: this.options.getFocusedProjectUri(),
			extraArgs,
			onPhase: this.options.onPhase,
		});
	}

	registerCommands(): void {
		const run = (subcommand: BeskidCliSubcommand) => () => this.run(subcommand);

		this.options.context.subscriptions.push(
			vscode.commands.registerCommand("beskid.cli.install", () => this.install()),
			vscode.commands.registerCommand("beskid.lsp.install", () =>
				this.installLsp(),
			),
			vscode.commands.registerCommand("beskid.cli.bootstrap", () =>
				this.bootstrap(true),
			),
			vscode.commands.registerCommand("beskid.cli.fetch", run("fetch")),
			vscode.commands.registerCommand("beskid.cli.lock", run("lock")),
			vscode.commands.registerCommand("beskid.cli.build", run("build")),
			vscode.commands.registerCommand("beskid.cli.test", run("test")),
			vscode.commands.registerCommand("beskid.cli.analyze", run("analyze")),
			vscode.commands.registerCommand("beskid.packages.fetch", run("fetch")),
			vscode.commands.registerCommand("beskid.packages.lock", run("lock")),
		);
	}

	focusedCwd(): string | undefined {
		return focusedProjectCwd(this.options.getFocusedProjectUri());
	}

	async installLsp(): Promise<void> {
		try {
			const result = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Installing Beskid LSP",
					cancellable: false,
				},
				async (progress) => {
					progress.report({ message: "Downloading latest LSP release…" });
					return installBeskidLsp(this.options.outputChannel);
				},
			);
			void vscode.window
				.showInformationMessage(
					`Beskid LSP ${result.version} installed to ${result.path}.`,
					"Restart LSP",
				)
				.then((choice) => {
					if (choice === "Restart LSP") {
						void vscode.commands.executeCommand("beskid.lsp.restart");
					}
				});
		} catch (error) {
			void vscode.window.showErrorMessage(
				`Failed to install Beskid LSP. See Beskid LSP output.`,
			);
			throw error;
		}
	}

	async install(): Promise<void> {
		try {
			const result = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Installing Beskid CLI",
					cancellable: false,
				},
				async (progress) => {
					progress.report({ message: "Downloading latest release…" });
					return installBeskidCli(this.options.outputChannel);
				},
			);
			void vscode.window.showInformationMessage(
				`Beskid CLI ${result.version} installed to ${result.path}.`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(
				`Failed to install Beskid CLI. See Beskid LSP output.`,
			);
			throw error;
		}
	}

	/** Download CLI and LSP (if needed), verify toolchain, and fetch workspace deps on first launch. */
	async ensureInstalled(progress?: ToolchainBootstrapProgress): Promise<string> {
		const result = await bootstrapBeskidToolchain(
			this.options.context,
			this.options.outputChannel,
			progress,
		);
		return result.cliPath;
	}

	async bootstrap(force = false): Promise<void> {
		if (force) {
			await this.options.context.globalState.update(
				"beskid.toolchain.bootstrapped",
				false,
			);
		}
		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Beskid toolchain",
					cancellable: false,
				},
				async (progress) => {
					progress.report({ message: "Setting up CLI and dependencies…" });
					await bootstrapBeskidToolchain(
						this.options.context,
						this.options.outputChannel,
					);
				},
			);
			void vscode.window.showInformationMessage(
				"Beskid toolchain setup completed.",
			);
		} catch {
			// bootstrapBeskidToolchain already logged and notified
		}
	}
}
