import * as vscode from "vscode";
import { NotificationType } from "vscode-languageserver-protocol";
import type { LanguageClient } from "vscode-languageclient/node";
import {
  createBeskidLanguageClient,
  requestWorkspaceRefresh,
} from "../lsp/beskidLanguageClient.js";
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
  ) {}

  getClient(): LanguageClient | undefined {
    return this.client;
  }

  async start(): Promise<LanguageClient> {
    if (this.client) {
      return this.client;
    }
    const client = createBeskidLanguageClient(
      this.context,
      this.outputChannel,
      this.getFocusedProject(),
    );
    client.onNotification(BeskidStatusNotification, (params) => {
      this.status.applyLspNotification(params);
    });
    this.client = client;
    await client.start();
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
