import { dirname } from "node:path";
import * as vscode from "vscode";
import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
} from "vscode-languageclient/node";
import { readLogServerOutput, readLspLogLevel } from "../config/workspaceSettings.js";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";
import { type BeskidClientHooks, buildExecuteCommandMiddleware } from "./clientHooks.js";
import { launchSnapshotFromExecutable } from "./launchSnapshot.js";
import { lspExecuteCommand } from "./lspExecuteCommand.js";
import {
  resolveLspServerLaunch,
  type LspInstallCli,
  type LspLaunchProgress,
} from "./resolveLspServerLaunch.js";

export function buildBeskidClientOptions(
  outputChannel: vscode.OutputChannel,
  selectedProjectUri: vscode.Uri | undefined,
  hooks?: BeskidClientHooks,
): LanguageClientOptions {
  return {
    documentSelector: [
      { scheme: "file", language: "beskid", pattern: "**/*.bd" },
      { scheme: "file", language: "beskid-manifest", pattern: "**/*.bproj" },
      { scheme: "file", language: "beskid-manifest", pattern: "**/*.bws" },
    ],
    synchronize: {
      configurationSection: ["beskid.lsp", "beskid"],
    },
    outputChannel,
    middleware: buildExecuteCommandMiddleware(hooks),
    initializationOptions: {
      focusedProjectUri: selectedProjectUri?.toString(),
      selectedProjectUri: selectedProjectUri?.toString(),
      logLevel: readLspLogLevel(),
      logServerOutput: readLogServerOutput(),
    },
  };
}

export async function createBeskidLanguageClient(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  focusedProjectUri: vscode.Uri | undefined,
  installCli: LspInstallCli,
  launchProgress: LspLaunchProgress | undefined,
  runtime: LspRuntimeState,
  hooks?: BeskidClientHooks,
): Promise<LanguageClient> {
  const serverOptions = await resolveLspServerLaunch(
    context,
    focusedProjectUri,
    installCli,
    launchProgress,
  );
  runtime.setLaunch(launchSnapshotFromExecutable(serverOptions.run));
  return new LanguageClient(
    "beskidLanguageServer",
    "Beskid Language Server",
    serverOptions,
    buildBeskidClientOptions(outputChannel, focusedProjectUri, hooks),
  );
}

export async function sendFocusedProjectConfiguration(
  client: LanguageClient,
  focusedProjectUri: vscode.Uri | undefined,
  outputChannel?: vscode.OutputChannel,
): Promise<void> {
  try {
    await client.sendNotification("workspace/didChangeConfiguration", {
      settings: {
        beskid: {
          project: {
            focusedProjectUri: focusedProjectUri?.toString() ?? null,
          },
        },
      },
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    outputChannel?.appendLine(`[Beskid LSP] Failed to sync focused project: ${detail}`);
    if (cause instanceof Error && cause.stack) {
      outputChannel?.appendLine(cause.stack);
    }
  }
}

export async function requestWorkspaceRefresh(
  client: LanguageClient | undefined,
  outputChannel?: vscode.OutputChannel,
): Promise<void> {
  await lspExecuteCommand(client, "beskid.refreshWorkspace", [], outputChannel);
}
