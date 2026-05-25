import { dirname } from "node:path";
import * as vscode from "vscode";
import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
} from "vscode-languageclient/node";
import { readLogServerOutput, readLspLogLevel } from "../config/workspaceSettings.js";
import { type BeskidClientHooks, buildExecuteCommandMiddleware } from "./clientHooks.js";
import { resolveLspServerLaunch, type LspInstallCli } from "./resolveLspServerLaunch.js";

export function buildBeskidClientOptions(
  outputChannel: vscode.OutputChannel,
  selectedProjectUri: vscode.Uri | undefined,
  hooks?: BeskidClientHooks,
): LanguageClientOptions {
  return {
    documentSelector: [
      { scheme: "file", language: "beskid", pattern: "**/*.bd" },
      { scheme: "file", language: "beskid-proj", pattern: "**/*.proj" },
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
  hooks?: BeskidClientHooks,
): Promise<LanguageClient> {
  const serverOptions = await resolveLspServerLaunch(context, focusedProjectUri, installCli);
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
  } catch {
    // server may not be ready
  }
}

export async function requestWorkspaceRefresh(client: LanguageClient | undefined): Promise<void> {
  if (!client) {
    return;
  }
  try {
    await client.sendRequest("workspace/executeCommand", {
      command: "beskid.refreshWorkspace",
      arguments: [],
    });
  } catch {
    // ignore if server isn't ready
  }
}
