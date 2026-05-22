import { spawn } from "node:child_process";
import { dirname } from "node:path";
import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { readCliPath } from "../config/workspaceSettings.js";
import type { BeskidActivityPhase } from "../packages/pckgActivity.js";

export type BeskidCliSubcommand = "fetch" | "lock" | "build" | "test" | "analyze";

export type CliRunPhase = BeskidCliSubcommand;

export type CliRunOptions = {
  subcommand: CliRunPhase;
  projectUri?: vscode.Uri;
  extraArgs?: string[];
  onPhase?: (phase: BeskidActivityPhase, active: boolean, detail?: string) => void;
};

export function focusedProjectCwd(projectUri: vscode.Uri | undefined): string | undefined {
  if (!projectUri) {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
  return dirname(projectUri.fsPath);
}

function projectRoot(projectUri: vscode.Uri | undefined): string | undefined {
  return focusedProjectCwd(projectUri);
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
  const cli = readCliPath();
  const args = [options.subcommand, ...(options.extraArgs ?? [])];
  options.onPhase?.(options.subcommand, true, `${cli} ${options.subcommand}…`);
  outputChannel.appendLine(`$ ${cli} ${args.join(" ")} (cwd: ${cwd})`);
  outputChannel.show(true);

  return new Promise((resolve) => {
    const child = spawn(cli, args, {
      cwd,
      shell: process.platform === "win32",
    });
    child.stdout.on("data", (chunk: Buffer) => outputChannel.append(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => outputChannel.append(chunk.toString()));
    child.on("close", (code) => {
      options.onPhase?.(options.subcommand, false);
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        void vscode.window.showErrorMessage(`Beskid ${options.subcommand} failed (exit ${exitCode}).`);
      } else {
        void vscode.window.showInformationMessage(`Beskid ${options.subcommand} completed.`);
      }
      resolve(exitCode);
    });
    child.on("error", (err) => {
      options.onPhase?.(options.subcommand, false);
      outputChannel.appendLine(String(err));
      void vscode.window.showErrorMessage(`Failed to run Beskid CLI: ${err.message}`);
      resolve(1);
    });
  });
}

/** Registry base URL: workspace `default` registry from LSP summary → `beskid.pckg.baseUrl` → localhost. */
export async function resolveRegistryBaseUrl(
  lspGetSummary: (workspaceUri: string) => Promise<{ registries: Record<string, string> } | undefined>,
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

export function registerCliCommands(
  context: ExtensionContext,
  outputChannel: vscode.OutputChannel,
  getFocusedProjectUri: () => vscode.Uri | undefined,
  onPhase?: (phase: BeskidActivityPhase, active: boolean, detail?: string) => void,
): void {
  const run = (subcommand: BeskidCliSubcommand) => async () => {
    await runBeskidCli(outputChannel, {
      subcommand,
      projectUri: getFocusedProjectUri(),
      onPhase,
    });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("beskid.cli.fetch", run("fetch")),
    vscode.commands.registerCommand("beskid.cli.lock", run("lock")),
    vscode.commands.registerCommand("beskid.cli.build", run("build")),
    vscode.commands.registerCommand("beskid.cli.test", run("test")),
    vscode.commands.registerCommand("beskid.cli.analyze", run("analyze")),
  );
}
