import * as vscode from "vscode";
import { WebviewPanelHost } from "../webviews/WebviewPanelHost.js";
import {
	type RegistryPanelState,
	renderPackageRegistryHtml,
} from "./packageRegistryHtml.js";
import type { PckgActivityReporter } from "./pckgActivity.js";
import type { PckgService } from "./pckgService.js";
import type { PackageDetails, PackageSearchRow } from "./pckgTypes.js";

const PANEL_TYPE = "beskidPackageRegistry";

export class PackageRegistryPanel extends WebviewPanelHost {
	private extensionUri: vscode.Uri | undefined;
	private state: RegistryPanelState = {
		query: "",
		loading: false,
		rows: [],
		registryBaseUrl: "",
	};

	constructor(
		private readonly pckg: PckgService,
		private readonly reportActivity: PckgActivityReporter,
	) {
		super();
	}

	register(context: vscode.ExtensionContext): void {
		this.extensionUri = context.extensionUri;
		context.subscriptions.push(
			vscode.commands.registerCommand(
				"beskid.packages.registrySearch",
				(query: string) => {
					this.open();
					void this.runSearch(query);
				},
			),
			vscode.commands.registerCommand(
				"beskid.packages.registrySelect",
				(name: string) => {
					this.open();
					void this.selectPackage(name);
				},
			),
		);
	}

	open(): void {
		if (!this.panel) {
			const panel = vscode.window.createWebviewPanel(
				PANEL_TYPE,
				"Beskid Packages",
				vscode.ViewColumn.One,
				{ enableScripts: true, retainContextWhenHidden: true },
			);
			const mediaRoot = this.extensionUri
				? vscode.Uri.joinPath(this.extensionUri, "media")
				: undefined;
			this.bindPanel(panel, mediaRoot ? [mediaRoot] : []);
			panel.webview.onDidReceiveMessage(
				(message: unknown) => void this.handleMessage(message),
			);
		} else {
			this.reveal();
		}
		void this.loadBrowse();
	}

	private async handleMessage(message: unknown): Promise<void> {
		if (!message || typeof message !== "object" || !("type" in message)) {
			return;
		}
		const msg = message as {
			type: string;
			query?: string;
			name?: string;
			url?: string;
			text?: string;
			command?: string;
		};
		switch (msg.type) {
			case "search":
				await this.runSearch(msg.query ?? "");
				break;
			case "refresh":
				await (this.state.query.trim()
					? this.runSearch(this.state.query)
					: this.loadBrowse());
				break;
			case "select":
				if (msg.name) {
					await this.selectPackage(msg.name);
				}
				break;
			case "openBrowser":
				if (msg.url?.startsWith("http://") || msg.url?.startsWith("https://")) {
					await vscode.env.openExternal(vscode.Uri.parse(msg.url));
				}
				break;
			case "copy":
				if (msg.text) {
					await vscode.env.clipboard.writeText(msg.text);
					void vscode.window.showInformationMessage("Copied to clipboard.");
				}
				break;
			case "command":
				if (msg.command) {
					void vscode.commands.executeCommand(msg.command);
				}
				break;
			default:
				break;
		}
	}

	private async loadBrowse(): Promise<void> {
		const base = await this.pckg.resolveRegistryBaseUrl();
		this.state = {
			...this.state,
			loading: true,
			error: undefined,
			registryBaseUrl: base,
			query: "",
		};
		this.render();
		this.reportActivity("search", true, "Loading catalog…");
		const result = await this.pckg.list(50);
		this.reportActivity("search", false);
		if (!result.ok) {
			this.state = {
				...this.state,
				loading: false,
				error: result.error,
				rows: [],
			};
		} else {
			this.state = { ...this.state, loading: false, rows: result.rows };
		}
		this.render();
	}

	private async runSearch(query: string): Promise<void> {
		const base = await this.pckg.resolveRegistryBaseUrl();
		this.state = {
			...this.state,
			query,
			loading: true,
			error: undefined,
			registryBaseUrl: base,
		};
		this.render();
		this.reportActivity(
			"search",
			true,
			query ? `Searching “${query}”…` : "Loading catalog…",
		);
		const result = query.trim()
			? await this.pckg.search(query.trim(), 50)
			: await this.pckg.list(50);
		this.reportActivity("search", false);
		if (!result.ok) {
			this.state = {
				...this.state,
				loading: false,
				error: result.error,
				rows: [],
			};
		} else {
			this.state = { ...this.state, loading: false, rows: result.rows };
		}
		this.render();
	}

	private async selectPackage(name: string): Promise<void> {
		this.state = {
			...this.state,
			selected: name,
			details: undefined,
			detailsLoading: true,
		};
		this.render();
		this.reportActivity("details", true, name);
		const result = await this.pckg.getDetails(name);
		this.reportActivity("details", false);
		if (!result.ok) {
			this.state = { ...this.state, detailsLoading: false, error: result.error };
		} else {
			this.state = { ...this.state, detailsLoading: false, details: result.data };
		}
		this.render();
	}

	private render(): void {
		const logoUri =
			this.panel && this.extensionUri
				? this.panel.webview
						.asWebviewUri(
							vscode.Uri.joinPath(this.extensionUri, "media", "beskid-logo.svg"),
						)
						.toString()
				: undefined;
		this.postHtml(renderPackageRegistryHtml({ ...this.state, logoUri }));
	}
}
