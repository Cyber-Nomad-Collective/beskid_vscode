import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { Executable } from "vscode-languageclient/node";
import { resolveCliExecutablePath } from "../config/workspaceSettings.js";
import {
  bundledPlatformArchKeys,
  platformArchKey,
  resolveBundledServerBinaryAt,
  resolveCompilerReleaseBinary,
  resolveCompilerWorkspaceRoot,
} from "./serverBinary.js";

export type LspInstallCli = () => Promise<string>;

function resolveExplicitServerPath(): string | undefined {
  const explicitPath = vscode.workspace
    .getConfiguration("beskid.lsp")
    .get<string>("server.path", "")
    .trim();
  return explicitPath.length > 0 ? explicitPath : undefined;
}

function resolveBundledServerBinary(context: ExtensionContext): string | undefined {
  const config = vscode.workspace.getConfiguration("beskid.lsp");
  if (!config.get<boolean>("server.preferBundled", false)) {
    return undefined;
  }
  return resolveBundledServerBinaryAt(context.extensionPath, bundledPlatformArchKeys());
}

function resolveCompilerWorkspaceRootFromContext(
  context: ExtensionContext,
): string | undefined {
  return resolveCompilerWorkspaceRoot(context.extensionPath, vscode.workspace.workspaceFolders);
}

function serverCwd(selectedProjectUri: vscode.Uri | undefined): { cwd?: string } {
  const config = vscode.workspace.getConfiguration("beskid.lsp");
  const configuredCwd = config.get<string>("server.cwd", "").trim();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const projectRoot = selectedProjectUri ? dirname(selectedProjectUri.fsPath) : undefined;
  const cwd = configuredCwd.length > 0 ? configuredCwd : projectRoot ?? workspaceRoot;
  return cwd ? { cwd } : {};
}

function executable(command: string, args: string[], options: { cwd?: string }): Executable {
  return { command, args, options };
}

function sameLaunch(launch: Executable): { run: Executable; debug: Executable } {
  return { run: launch, debug: launch };
}

function resolveLocalCompilerCli(compilerRoot: string | undefined): string | undefined {
  if (!compilerRoot) {
    return undefined;
  }
  const binaryName = process.platform === "win32" ? "beskid_cli.exe" : "beskid_cli";
  const localCli = join(compilerRoot, "target", "release", binaryName);
  return existsSync(localCli) ? localCli : undefined;
}

export async function resolveLspServerLaunch(
  context: ExtensionContext,
  selectedProjectUri: vscode.Uri | undefined,
  installCli: LspInstallCli,
): Promise<{ run: Executable; debug: Executable }> {
  const config = vscode.workspace.getConfiguration("beskid.lsp");
  const options = serverCwd(selectedProjectUri);
  const compilerRoot = resolveCompilerWorkspaceRootFromContext(context);
  const devMode = config.get<boolean>("server.devMode", false);

  const explicitPath = resolveExplicitServerPath();
  if (explicitPath) {
    return sameLaunch(executable(explicitPath, [], options));
  }

  let cliPath = resolveCliExecutablePath() ?? resolveLocalCompilerCli(compilerRoot);
  if (!cliPath && !devMode && !compilerRoot) {
    cliPath = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Beskid",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Downloading CLI release and preparing workspace…" });
        return installCli();
      },
    );
  }

  if (cliPath) {
    return sameLaunch(executable(cliPath, ["lsp"], options));
  }

  const bundledBinary = resolveBundledServerBinary(context);
  if (bundledBinary) {
    return sameLaunch(executable(bundledBinary, [], options));
  }

  const releaseBinary = compilerRoot ? resolveCompilerReleaseBinary(compilerRoot) : undefined;
  if (releaseBinary) {
    const releaseOptions = compilerRoot ? { cwd: compilerRoot } : options;
    return sameLaunch(executable(releaseBinary, [], releaseOptions));
  }

  if (!devMode && !compilerRoot) {
    const platformKey = platformArchKey() ?? `${process.platform}-${process.arch}`;
    const message =
      `Beskid language server could not be started for ${platformKey}. ` +
      "Run **Beskid: Install CLI**, set `beskid.lsp.server.path`, or enable `beskid.lsp.server.devMode`.";
    void vscode.window.showErrorMessage(message);
    throw new Error(message);
  }

  const command = config.get<string>("server.command", "cargo");
  const args = config.get<string[]>("server.args", ["run", "-p", "beskid_lsp"]);
  const debugArgs = config.get<string[]>("server.debugArgs", ["run", "-p", "beskid_lsp"]);
  const sourceOptions = compilerRoot ? { cwd: compilerRoot } : options;

  return {
    run: executable(command, args, sourceOptions),
    debug: executable(command, debugArgs, sourceOptions),
  };
}
