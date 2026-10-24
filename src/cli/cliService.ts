import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";
import {
	type BeskidCliOperation,
	focusedProjectCwd,
	runBeskidCli,
} from "./beskidCliRunner.js";
import { migrateLockTargetPath } from "./migrateLock.js";

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
		subcommand: BeskidCliOperation,
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
		const run = (subcommand: BeskidCliOperation) => () => this.run(subcommand);

		this.options.context.subscriptions.push(
			vscode.commands.registerCommand("beskid.cli.fetch", run("fetch")),
			vscode.commands.registerCommand("beskid.cli.lock", run("lock")),
			vscode.commands.registerCommand("beskid.cli.build", run("build")),
			vscode.commands.registerCommand("beskid.cli.test", run("test")),
			vscode.commands.registerCommand("beskid.cli.check", run("check")),
			vscode.commands.registerCommand("beskid.packages.fetch", run("fetch")),
			vscode.commands.registerCommand("beskid.packages.lock", run("lock")),
			vscode.commands.registerCommand("beskid.migrateLock", (target?: unknown) =>
				this.migrateLock(target),
			),
		);
	}

	focusedCwd(): string | undefined {
		return focusedProjectCwd(this.options.getFocusedProjectUri());
	}

	/**
	 * "Migrate lock file" quick fix. The server offers it for a version 1
	 * `Project.lock`; migrating means re-resolving with `beskid dev project lock`,
	 * which writes the current lock format. Then the workspace refreshes.
	 */
	async migrateLock(target?: unknown): Promise<number> {
		const path = migrateLockTargetPath(target);
		const projectUri = path
			? vscode.Uri.file(path)
			: this.options.getFocusedProjectUri();
		const exitCode = await runBeskidCli(this.options.outputChannel, {
			subcommand: "lock",
			projectUri,
			onPhase: this.options.onPhase,
		});
		if (exitCode === 0) {
			await vscode.commands.executeCommand("beskid.refreshWorkspace");
		}
		return exitCode;
	}
}
