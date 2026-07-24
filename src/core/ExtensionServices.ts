import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import {
	type RuntimeUiHandles,
	registerRuntimeUi,
} from "../activation/registerRuntimeUi.js";
import {
	type RegisteredViews,
	registerViews,
} from "../activation/registerViews.js";
import { registerBeskidTaskProvider } from "../cli/beskidTaskProvider.js";
import { CliService } from "../cli/cliService.js";
import {
	assessToolchainNeeds,
	onboardingProgressMessage,
	shouldAutoInstallToolchainOnLaunch,
} from "../cli/ensureToolchainOnLaunch.js";
import { registerCommands } from "../commands/registerCommands.js";
import { registerCoreCommands } from "../commands/registerCoreCommands.js";
import { readDashboardOpenOnActivate } from "../config/workspaceSettings.js";
import { BeskidDebugTreeProvider } from "../debug/BeskidDebugTreeProvider.js";
import { GraphExplorerPanel } from "../graphs/GraphExplorerPanel.js";
import { LspPckgApi } from "../packages/lspPckgApi.js";
import {
	formatPckgConnectionLabel,
	PackageManagerProvider,
} from "../packages/PackageManagerProvider.js";
import { PackageRegistryPanel } from "../packages/PackageRegistryPanel.js";
import { PckgService } from "../packages/pckgService.js";
import { BeskidLspSession } from "../runtime/BeskidLspSession.js";
import { registerExtensionWatchers } from "../runtime/extensionWatchers.js";
import { FocusCoordinator } from "../runtime/FocusCoordinator.js";
import { LspRuntimeState } from "../runtime/LspRuntimeState.js";
import { registerRuntimeConfiguration } from "../runtime/runtimeConfiguration.js";
import { BeskidStatusController } from "../status/beskidStatusController.js";
import { LspProjectApi } from "../workspace/lspProjectApi.js";
import { ProjectsTreeProvider } from "../workspace/ProjectsTreeProvider.js";
import { RefreshCoordinator } from "./RefreshCoordinator.js";

export class ExtensionServices {
	readonly outputChannel: vscode.OutputChannel;
	readonly statusBar: vscode.StatusBarItem;
	readonly runtime: LspRuntimeState;
	readonly status: BeskidStatusController;
	readonly focus: FocusCoordinator;
	readonly session: BeskidLspSession;
	readonly lspApi: LspProjectApi;
	readonly graphPanel: GraphExplorerPanel;
	readonly lspPckg: LspPckgApi;
	readonly refresh: RefreshCoordinator;
	readonly cli: CliService;
	readonly pckg: PckgService;
	readonly packageProvider: PackageManagerProvider;
	readonly registryPanel: PackageRegistryPanel;
	readonly projectsTree: ProjectsTreeProvider;
	readonly debugProvider: BeskidDebugTreeProvider;
	readonly views: RegisteredViews;
	readonly runtimeUi: RuntimeUiHandles;

	private workspaceProjUri: string | undefined;

	constructor(private readonly context: ExtensionContext) {
		this.outputChannel = vscode.window.createOutputChannel("Beskid LSP");
		this.runtime = new LspRuntimeState();
		this.statusBar = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100,
		);
		this.statusBar.command = "beskid.modal.open";
		this.statusBar.show();
		this.status = new BeskidStatusController(this.statusBar, this.runtime);

		this.focus = new FocusCoordinator(context, this.outputChannel);
		this.runtime.setFocusedProject(this.focus.getFocusedProject());

		this.session = new BeskidLspSession(
			context,
			this.outputChannel,
			this.runtime,
			() => this.focus.getFocusedProject(),
			(progress) => this.cli.ensureInstalled(progress),
			{
				onRefreshWorkspaceUi: async () => {
					this.packageProvider.clearCaches();
					await this.refresh.run({ projectsTree: true });
					this.packageProvider.refresh();
					void this.graphPanel.refresh();
				},
			},
		);
		this.lspApi = new LspProjectApi(
			() => this.session.getClient(),
			this.outputChannel,
		);
		this.lspPckg = new LspPckgApi(
			() => this.session.getClient(),
			this.outputChannel,
		);

		this.projectsTree = new ProjectsTreeProvider(
			() => this.session.getClient(),
			() => this.focus.getFocusedProject(),
			this.lspApi,
			() => this.runtime.getSnapshot().phase,
		);

		this.refresh = new RefreshCoordinator({
			getClient: () => this.session.getClient(),
			projectsTree: this.projectsTree,
			outputChannel: this.outputChannel,
		});
		this.session.setOnClientReady(() => this.refresh.scheduleLspReady());

		this.pckg = new PckgService(
			context,
			this.lspApi,
			this.lspPckg,
			() => this.workspaceProjUri,
		);

		const reportActivity = (
			phase: Parameters<LspRuntimeState["setPckgActivity"]>[0],
			active: boolean,
			detail?: string,
		) => this.runtime.setPckgActivity(phase, active, detail);

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
			reportConnectionStatus: (status) => {
				this.runtime.setPckgConnection({
					connected: status.connected,
					label: formatPckgConnectionLabel(status),
				});
			},
			cli: this.cli,
			refreshUi: async () => {
				await this.refresh.scheduleFull();
				void this.packageProvider.refreshProjectSection();
			},
		});

		this.registryPanel = new PackageRegistryPanel(this.pckg, reportActivity);
		this.registryPanel.register(context);

		this.graphPanel = new GraphExplorerPanel(
			context.extensionUri,
			this.lspApi,
			() => this.focus.getFocusedProject(),
		);

		const extensionVersion = context.extension.packageJSON.version ?? "0.0.0";
		this.debugProvider = new BeskidDebugTreeProvider(this.runtime);
		this.runtimeUi = registerRuntimeUi(context, this.runtime, extensionVersion);

		registerCoreCommands(context, this);

		this.views = registerViews(context, {
			projectsTree: this.projectsTree,
			packageProvider: this.packageProvider,
			debugProvider: this.debugProvider,
		});

		this.focus.onDidChangeFocus(({ projectUri }) => {
			this.runtime.setFocusedProject(projectUri);
			this.refresh.scheduleFocusUi();
			void this.packageProvider.refreshProjectSection();
		});
	}

	static create(context: ExtensionContext): ExtensionServices {
		return new ExtensionServices(context);
	}

	async activate(): Promise<void> {
		this.context.subscriptions.push(
			this.outputChannel,
			this.statusBar,
			this.runtime,
			{ dispose: () => this.status.dispose() },
		);
		registerCommands(this.context, this);
		registerBeskidTaskProvider(this.context);
		this.cli.registerCommands();
		registerExtensionWatchers(this.context, this.refresh, () => {
			void this.packageProvider.refreshProjectSection();
		});
		registerRuntimeConfiguration(this.context, {
			session: this.session,
			packageProvider: this.packageProvider,
			runtime: this.runtime,
		});
		this.context.subscriptions.push(
			this.focus.registerAutoSelect(() => this.session.getClient(), this.refresh),
		);
		await this.ensureToolchainForLaunch();
		await this.session.start();
		const { workspaces } = await this.lspApi.listWorkspaces();
		this.workspaceProjUri = workspaces[0]?.uri;
		this.projectsTree.refresh();
		this.packageProvider.refresh();
		void this.pckg
			.probePublicCatalog()
			.then(() => this.packageProvider.refreshProjectSection());
		await this.focus.autoSelectFromActiveEditor(
			this.session.getClient(),
			this.refresh,
		);

		if (readDashboardOpenOnActivate()) {
			void this.runtimeUi.modal.open();
		}
	}

	async deactivate(): Promise<void> {
		await this.session.stop();
	}

	private async ensureToolchainForLaunch(): Promise<void> {
		if (!shouldAutoInstallToolchainOnLaunch()) {
			this.outputChannel.appendLine(
				"[Beskid] Automatic toolchain install skipped (dev mode, explicit server path, or setting disabled).",
			);
			return;
		}

		const assessment = await assessToolchainNeeds(this.context);
		if (!assessment.requiresBootstrap) {
			this.outputChannel.appendLine("[Beskid] Toolchain ready.");
			return;
		}

		this.runtime.setPhase(
			assessment.downloading ? "downloading" : "bootstrapping",
		);
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Beskid",
				cancellable: false,
			},
			async (progress) => {
				progress.report({ message: onboardingProgressMessage(assessment) });
				await this.cli.ensureInstalled({
					onDownloading: () => this.runtime.setPhase("downloading"),
					onBootstrapping: () => this.runtime.setPhase("bootstrapping"),
				});
			},
		);
	}

	async showQuickActions(): Promise<void> {
		const selected = await vscode.window.showQuickPick(
			[
				{ label: "Show project graph", command: "beskid.showGraph" },
				{ label: "Open quick panel", command: "beskid.modal.open" },
				{ label: "Browse packages", command: "beskid.packages.open" },
				{ label: "Setup toolchain", command: "beskid.cli.bootstrap" },
				{ label: "Install CLI", command: "beskid.cli.install" },
				{ label: "Install LSP", command: "beskid.lsp.install" },
				{ label: "Start LSP", command: "beskid.lsp.start" },
				{ label: "Stop LSP", command: "beskid.lsp.stop" },
				{ label: "Restart LSP", command: "beskid.lsp.restart" },
				{ label: "Open LSP Logs", command: "beskid.lsp.openLogs" },
				{ label: "Refresh Workspace", command: "beskid.refreshWorkspace" },
				{ label: "Fetch dependencies", command: "beskid.packages.fetch" },
				{ label: "Lock dependencies", command: "beskid.packages.lock" },
				{
					label: "Configure registry API key",
					command: "beskid.packages.configureApiKey",
				},
			],
			{ placeHolder: "Beskid quick actions" },
		);
		if (selected) {
			await vscode.commands.executeCommand(selected.command);
		}
	}
}
