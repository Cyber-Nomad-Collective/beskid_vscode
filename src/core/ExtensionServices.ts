import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { registerViews, type RegisteredViews } from "../activation/registerViews.js";
import { registerBeskidTaskProvider } from "../cli/beskidTaskProvider.js";
import { CliService } from "../cli/cliService.js";
import { registerCommands } from "../commands/registerCommands.js";
import { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import { PckgService } from "../packages/pckgService.js";
import { SelectedProjectOutlineProvider } from "../outline/SelectedProjectOutlineProvider.js";
import { BeskidStatusController } from "../status/beskidStatusController.js";
import { FocusCoordinator } from "../runtime/FocusCoordinator.js";
import { BeskidLspSession } from "../runtime/BeskidLspSession.js";
import { registerExtensionWatchers } from "../runtime/extensionWatchers.js";
import { registerRuntimeConfiguration } from "../runtime/runtimeConfiguration.js";
import { ProjectTreeProvider } from "../workspace/ProjectTreeProvider.js";
import { WorkspaceTreeProvider } from "../workspace/WorkspaceTreeProvider.js";
import { LspProjectApi } from "../workspace/lspProjectApi.js";
import { RefreshCoordinator } from "./RefreshCoordinator.js";

export class ExtensionServices {
  readonly outputChannel: vscode.OutputChannel;
  readonly statusBar: vscode.StatusBarItem;
  readonly status: BeskidStatusController;
  readonly focus: FocusCoordinator;
  readonly session: BeskidLspSession;
  readonly lspApi: LspProjectApi;
  readonly refresh: RefreshCoordinator;
  readonly cli: CliService;
  readonly pckg: PckgService;
  readonly packageProvider: PackageManagerProvider;
  readonly outlineProvider: SelectedProjectOutlineProvider;
  readonly workspaceTree: WorkspaceTreeProvider;
  readonly projectTree: ProjectTreeProvider;
  readonly views: RegisteredViews;

  private workspaceProjUri: string | undefined;

  constructor(private readonly context: ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel("Beskid LSP");
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "beskid.lsp.quickActions";
    this.statusBar.show();
    this.status = new BeskidStatusController(this.statusBar);
    this.status.setLspClientRunning(false);

    this.focus = new FocusCoordinator(context);
    this.session = new BeskidLspSession(
      context,
      this.outputChannel,
      this.status,
      () => this.focus.getFocusedProject(),
    );
    this.lspApi = new LspProjectApi(() => this.session.getClient());

    this.outlineProvider = new SelectedProjectOutlineProvider();
    this.workspaceTree = new WorkspaceTreeProvider(
      () => this.session.getClient(),
      async (uri) => this.focus.setFocusedProject(uri, this.session.getClient(), this.refresh),
      this.lspApi,
    );
    this.projectTree = new ProjectTreeProvider(
      () => this.session.getClient(),
      () => this.focus.getFocusedProject(),
      this.lspApi,
    );

    this.refresh = new RefreshCoordinator({
      getClient: () => this.session.getClient(),
      workspaceTree: this.workspaceTree,
      projectTree: this.projectTree,
    });

    this.pckg = new PckgService(context, this.lspApi, () => this.workspaceProjUri);

    const reportActivity = (
      phase: Parameters<BeskidStatusController["setPckgActivity"]>[0],
      active: boolean,
      detail?: string,
    ) => this.status.setPckgActivity(phase, active, detail);

    this.cli = new CliService({
      context,
      outputChannel: this.outputChannel,
      getFocusedProjectUri: () => this.focus.getFocusedProject(),
      onPhase: reportActivity,
    });

    this.packageProvider = new PackageManagerProvider({
      context,
      pckg: this.pckg,
      getFocusedProjectUri: () => this.focus.getFocusedProject(),
      lspApi: this.lspApi,
      reportActivity,
      cli: this.cli,
      refreshUi: async () => {
        await this.refresh.scheduleFull();
        void this.packageProvider.refreshProjectSection();
      },
    });

    this.views = registerViews(context, {
      workspaceTree: this.workspaceTree,
      projectTree: this.projectTree,
      packageProvider: this.packageProvider,
      outlineProvider: this.outlineProvider,
    });

    this.focus.onDidChangeFocus(({ projectUri }) => {
      this.outlineProvider.setProject(projectUri);
      this.refresh.scheduleFocusUi();
      void this.packageProvider.refreshProjectSection();
    });
    this.outlineProvider.setProject(this.focus.getFocusedProject());
  }

  static create(context: ExtensionContext): ExtensionServices {
    return new ExtensionServices(context);
  }

  async activate(): Promise<void> {
    this.context.subscriptions.push(this.outputChannel, this.statusBar);
    registerCommands(this.context, this);
    registerBeskidTaskProvider(this.context);
    this.cli.registerCommands();
    registerExtensionWatchers(this.context, this.refresh, () => {
      void this.packageProvider.refreshProjectSection();
    });
    registerRuntimeConfiguration(this.context, {
      session: this.session,
      packageProvider: this.packageProvider,
    });
    this.context.subscriptions.push(
      this.focus.registerAutoSelect(() => this.session.getClient(), this.refresh),
    );
    await this.session.start();
    const workspaces = await this.lspApi.listWorkspaces();
    this.workspaceProjUri = workspaces[0]?.uri;
    this.workspaceTree.refresh();
    this.packageProvider.refresh();
    await this.focus.autoSelectFromActiveEditor(this.session.getClient(), this.refresh);
  }

  async deactivate(): Promise<void> {
    await this.session.stop();
  }

  async showQuickActions(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
      [
        { label: "Start LSP", command: "beskid.lsp.start" },
        { label: "Stop LSP", command: "beskid.lsp.stop" },
        { label: "Restart LSP", command: "beskid.lsp.restart" },
        { label: "Open LSP Logs", command: "beskid.lsp.openLogs" },
        { label: "Refresh Workspace", command: "beskid.refreshWorkspace" },
        { label: "Fetch dependencies", command: "beskid.packages.fetch" },
        { label: "Lock dependencies", command: "beskid.packages.lock" },
        { label: "Configure registry API key", command: "beskid.packages.configureApiKey" },
      ],
      { placeHolder: "Beskid quick actions" },
    );
    if (selected) {
      await vscode.commands.executeCommand(selected.command);
    }
  }
}
