import * as vscode from "vscode";
import { NotificationType, State } from "vscode-languageclient";
import type { LanguageClient } from "vscode-languageclient/node";
import type { BeskidClientHooks } from "../lsp/clientHooks.js";
import {
  createBeskidLanguageClient,
  requestWorkspaceRefresh,
} from "../lsp/beskidLanguageClient.js";
import { probeCliVersion } from "../lsp/probeCliVersion.js";
import type { LspInstallCli, LspLaunchProgress } from "../lsp/resolveLspServerLaunch.js";
import type { BeskidStatusParams } from "../status/beskidStatusTypes.js";
import type { LspRuntimeState } from "./LspRuntimeState.js";

const BeskidStatusNotification = new NotificationType<BeskidStatusParams>("beskid/status");

export class BeskidLspSession {
  private client: LanguageClient | undefined;
  private clientStateDisposable: vscode.Disposable | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly runtime: LspRuntimeState,
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

    this.runtime.setPhase("starting");
    const launchProgress: LspLaunchProgress = {
      onDownloading: () => this.runtime.setPhase("downloading"),
      onBootstrapping: () => this.runtime.setPhase("bootstrapping"),
    };

    const client = await createBeskidLanguageClient(
      this.context,
      this.outputChannel,
      this.getFocusedProject(),
      (progress) => this.installCli(progress ?? launchProgress),
      launchProgress,
      this.runtime,
      this.clientHooks,
    );

    client.onNotification(BeskidStatusNotification, (params) => {
      this.runtime.applyLspNotification(params);
    });

    this.client = client;
    this.attachClientStateListener(client);

    try {
      await client.start();
    } catch (error) {
      this.client = undefined;
      this.clientStateDisposable?.dispose();
      this.clientStateDisposable = undefined;
      const detail = error instanceof Error ? error.message : String(error);
      this.runtime.setError(detail);
      this.outputChannel.appendLine(`[Beskid LSP] Failed to start language server: ${detail}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(error.stack);
      }
      this.outputChannel.show(true);
      void vscode.window
        .showErrorMessage(
          "Beskid language server failed to start. See Beskid LSP output for details.",
          "Open Output",
        )
        .then((choice) => {
          if (choice === "Open Output") {
            this.outputChannel.show(true);
          }
        });
      throw error;
    }

    this.runtime.setClientRunning(true);
    void this.probeVersions();
    await requestWorkspaceRefresh(this.client);
    return client;
  }

  async stop(): Promise<void> {
    if (!this.client) {
      return;
    }
    const current = this.client;
    this.client = undefined;
    this.clientStateDisposable?.dispose();
    this.clientStateDisposable = undefined;
    await current.stop();
    this.runtime.setClientRunning(false);
  }

  async restart(): Promise<LanguageClient> {
    await this.stop();
    return this.start();
  }

  private attachClientStateListener(client: LanguageClient): void {
    this.clientStateDisposable?.dispose();
    this.clientStateDisposable = client.onDidChangeState((event) => {
      if (event.newState === State.Starting) {
        this.runtime.setPhase("starting");
      } else if (event.newState === State.Running) {
        this.runtime.setClientRunning(true);
      } else if (event.newState === State.Stopped) {
        this.runtime.setClientRunning(false);
      }
    });
  }

  private async probeVersions(): Promise<void> {
    const launch = this.runtime.getSnapshot().launch;
    if (!launch) {
      return;
    }
    const cliPath = launch.args.includes("lsp") ? launch.command : launch.binaryPath;
    const cliVersion = await probeCliVersion(cliPath);
    if (cliVersion) {
      this.runtime.setVersions(cliVersion, undefined);
    }
  }
}
