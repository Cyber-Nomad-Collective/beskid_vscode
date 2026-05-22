import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";
import {
  type BeskidCliSubcommand,
  focusedProjectCwd,
  runBeskidCli,
} from "./beskidCliRunner.js";

export type CliServiceOptions = {
  context: ExtensionContext;
  outputChannel: vscode.OutputChannel;
  getFocusedProjectUri: () => vscode.Uri | undefined;
  onPhase?: (phase: BeskidActivityPhase, active: boolean, detail?: string) => void;
};

export class CliService {
  constructor(private readonly options: CliServiceOptions) {}

  async run(subcommand: BeskidCliSubcommand, extraArgs?: string[]): Promise<number> {
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
}
