import * as vscode from "vscode";
import { NotificationType } from "vscode-languageserver-protocol";
import type { LanguageClient } from "vscode-languageclient/node";
import type { BeskidClientHooks } from "../lsp/clientHooks.js";
import {
  createBeskidLanguageClient,
  requestWorkspaceRefresh,
} from "../lsp/beskidLanguageClient.js";
import type { LspInstallCli } from "../lsp/resolveLspServerLaunch.js";
import { BeskidStatusController } from "../status/beskidStatusController.js";
import type { BeskidStatusParams } from "../status/beskidStatusTypes.js";

const BeskidStatusNotification = new NotificationType<BeskidStatusParams>("beskid/status");

export class BeskidLspSession {
  private client: LanguageClient | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly status: BeskidStatusController,
    private readonly getFocusedProject: () => vscode.Uri | undefined,
    private readonly installCli: LspInstallCli,
    private readonly clientHooks?: BeskidClientHooks,
  ) {}

  getClient(): LanguageClient | undefined {
    return this.client;
  }

  async start(): Promise<LanguageClient> {
    if (this.client) {
      return this.client;
    }
    const client = await createBeskidLanguageClient(
      this.context,
      this.outputChannel,
      this.getFocusedProject(),
      this.installCli,
      this.clientHooks,
    );
    client.onNotification(BeskidStatusNotification, (params) => {
      this.status.applyLspNotification(params);
    });
    this.client = client;
    try {
      await client.start();
    } catch (error) {
      this.client = undefined;
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[Beskid LSP] Failed to start language server: ${detail}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(error.stack);
      }
      this.outputChannel.show(true);
      void vscode.window.showErrorMessage(
        "Beskid language server failed to start. See Beskid LSP output for details.",
        "Open Output",
      ).then((choice) => {
        if (choice === "Open Output") {
          this.outputChannel.show(true);
        }
      });
      throw error;
    }
    this.status.setLspClientRunning(true);
    await requestWorkspaceRefresh(this.client);
    return client;
  }

  async stop(): Promise<void> {
    if (!this.client) {
      return;
    }
    const current = this.client;
    this.client = undefined;
    await current.stop();
    this.status.setLspClientRunning(false);
  }

  async restart(): Promise<LanguageClient> {
    await this.stop();
    return this.start();
  }
}
