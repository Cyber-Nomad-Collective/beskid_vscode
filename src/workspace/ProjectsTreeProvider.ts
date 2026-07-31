import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import type { LspRuntimePhase } from "../runtime/lspRuntimeTypes.js";
import type { LspProjectApi } from "./lspProjectApi.js";
import type { WorkspaceListEntry } from "./lspProjectTypes.js";
import { ProjectsTreeItem } from "./ProjectsTreeItem.js";
import {
	projectSectionChildren,
	projectSectionItems,
} from "./projectGraphTree.js";
import {
	ContextValue,
	prefixMultiRootLabel,
	themeIcon,
} from "./tree/treeItemHelpers.js";

const STARTING_PHASES = new Set<LspRuntimePhase>([
	"starting",
	"downloading",
	"bootstrapping",
]);

function truncateMessage(message: string, max = 120): string {
	const trimmed = message.trim();
	if (trimmed.length <= max) {
		return trimmed;
	}
	return `${trimmed.slice(0, max - 1)}…`;
}

/** Workspaces as containers; member projects expand into targets, deps, and sources. */
export class ProjectsTreeProvider
	implements vscode.TreeDataProvider<ProjectsTreeItem>
{
	private readonly emitter = new vscode.EventEmitter<
		ProjectsTreeItem | undefined | null | undefined
	>();
	readonly onDidChangeTreeData = this.emitter.event;

	private workspaces: WorkspaceListEntry[] = [];
	private standaloneProjectUris: string[] = [];
	private listWorkspacesError: string | undefined;

	constructor(
		private readonly getClient: () => LanguageClient | undefined,
		private readonly getFocusedProject: () => vscode.Uri | undefined,
		private readonly lspApi?: LspProjectApi,
		private readonly getRuntimePhase?: () => LspRuntimePhase,
	) {}

	refresh(): void {
		this.emitter.fire(undefined);
	}

	getRevealTarget(projectUri: vscode.Uri): ProjectsTreeItem {
		const projectStr = projectUri.toString();
		for (const ws of this.workspaces) {
			const member = ws.members.find((m) => m.uri === projectStr);
			if (member && ws.uri) {
				return new ProjectsTreeItem(
					"member",
					member.name,
					vscode.TreeItemCollapsibleState.Expanded,
					projectStr,
					undefined,
					undefined,
					ws.uri,
				);
			}
		}
		return new ProjectsTreeItem(
			"standalone",
			vscode.workspace.asRelativePath(projectUri),
			vscode.TreeItemCollapsibleState.Expanded,
			projectStr,
		);
	}

	getTreeItem(element: ProjectsTreeItem): vscode.TreeItem {
		if (element.unresolved || element.nodeType === "warning") {
			element.iconPath = themeIcon("warning");
		}
		return element;
	}

	async getChildren(element?: ProjectsTreeItem): Promise<ProjectsTreeItem[]> {
		if (!element) {
			return this.getRootChildren();
		}

		switch (element.nodeType) {
			case "workspace":
				return this.getWorkspaceChildren(element);
			case "standalone":
			case "member":
				if (element.projectUri && this.lspApi) {
					return projectSectionItems(this.lspApi, element.projectUri);
				}
				return [];
			case "section":
				if (element.projectUri && element.section && this.lspApi) {
					const result = await projectSectionChildren(
						this.lspApi,
						element.projectUri,
						element.section,
						element.workspaceUri,
					);
					return result.items;
				}
				return [];
			default:
				return [];
		}
	}

	private async getRootChildren(): Promise<ProjectsTreeItem[]> {
		const client = this.getClient();
		if (!client) {
			const item = new ProjectsTreeItem(
				"info",
				"Start Beskid LSP to load projects.",
				vscode.TreeItemCollapsibleState.None,
			);
			item.command = { command: "beskid.lsp.start", title: "Start Beskid LSP" };
			item.iconPath = themeIcon("info");
			return [item];
		}
		if (!this.lspApi) {
			return [];
		}

		const phase = this.getRuntimePhase?.() ?? "idle";
		if (STARTING_PHASES.has(phase)) {
			const item = new ProjectsTreeItem(
				"info",
				"Language server starting…",
				vscode.TreeItemCollapsibleState.None,
			);
			item.iconPath = themeIcon("sync~spin");
			return [item];
		}

		const outcome = await this.lspApi.listWorkspaces();
		this.listWorkspacesError = outcome.error;
		this.workspaces = outcome.workspaces;
		this.standaloneProjectUris = await this.discoverStandaloneProjectUris(
			this.workspaces,
		);

		if (this.listWorkspacesError) {
			const item = new ProjectsTreeItem(
				"warning",
				`Failed to list workspaces: ${truncateMessage(this.listWorkspacesError)}`,
				vscode.TreeItemCollapsibleState.None,
			);
			item.command = { command: "beskid.lsp.openLogs", title: "Open LSP logs" };
			return [item];
		}

		const items: ProjectsTreeItem[] = [];

		for (const ws of this.workspaces) {
			const label = prefixMultiRootLabel(ws.name, ws.uri);
			const item = new ProjectsTreeItem(
				"workspace",
				label,
				vscode.TreeItemCollapsibleState.Expanded,
				undefined,
				undefined,
				undefined,
				ws.uri,
			);
			item.iconPath = themeIcon("root-folder");
			item.contextValue = ContextValue.workspace;
			items.push(item);
		}

		for (const uri of this.standaloneProjectUris) {
			const parsed = vscode.Uri.parse(uri);
			const item = new ProjectsTreeItem(
				"standalone",
				vscode.workspace.asRelativePath(parsed),
				vscode.TreeItemCollapsibleState.Collapsed,
				uri,
			);
			item.iconPath = themeIcon("project");
			item.description = "Project";
			item.contextValue = ContextValue.standaloneProject;
			item.command = {
				command: "beskid.focusProject",
				title: "Focus project",
				arguments: [parsed],
			};
			if (this.getFocusedProject()?.toString() === uri) {
				item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
			}
			items.push(item);
		}

		if (items.length === 0) {
			return [
				new ProjectsTreeItem(
					"info",
					"No .bws or .bproj manifest found in open folders.",
					vscode.TreeItemCollapsibleState.None,
				),
			];
		}

		return items;
	}

	private getWorkspaceChildren(
		element: ProjectsTreeItem,
	): Promise<ProjectsTreeItem[]> {
		const ws = this.workspaces.find((w) => w.uri === element.workspaceUri);
		if (!ws) {
			return Promise.resolve([]);
		}

		const focusedUri = this.getFocusedProject()?.toString();
		const children: ProjectsTreeItem[] = ws.members.map((member) => {
			const projectUri = member.uri?.trim() ? member.uri : undefined;
			if (!projectUri) {
				const warning = new ProjectsTreeItem(
					"warning",
					`${member.name} (no .bproj found)`,
					vscode.TreeItemCollapsibleState.None,
					undefined,
					undefined,
					true,
					ws.uri,
				);
				warning.description = member.memberId ?? member.path;
				return warning;
			}
			const expanded = projectUri === focusedUri;
			const item = new ProjectsTreeItem(
				"member",
				member.name,
				expanded
					? vscode.TreeItemCollapsibleState.Expanded
					: vscode.TreeItemCollapsibleState.Collapsed,
				projectUri,
				undefined,
				undefined,
				ws.uri,
			);
			item.description = member.memberId ?? member.name;
			item.iconPath = themeIcon("folder-library");
			item.contextValue = ContextValue.workspaceMember;
			item.command = {
				command: "beskid.focusProject",
				title: "Focus project",
				arguments: [vscode.Uri.parse(projectUri)],
			};
			return item;
		});

		const wsRoot = vscode.Uri.parse(ws.uri).fsPath;
		const pkgJson = join(dirname(wsRoot), "workspace.package.json");
		const hint = new ProjectsTreeItem(
			"hint",
			"workspace.package.json",
			vscode.TreeItemCollapsibleState.None,
			undefined,
			undefined,
			undefined,
			ws.uri,
		);
		hint.iconPath = themeIcon("json");
		if (existsSync(pkgJson)) {
			hint.resourceUri = vscode.Uri.file(pkgJson);
			hint.command = {
				command: "vscode.open",
				title: "Open workspace.package.json",
				arguments: [hint.resourceUri],
			};
			hint.description = "Open workspace metadata";
		} else {
			hint.description = "Not present in workspace root";
		}
		children.push(hint);

		return Promise.resolve(children);
	}

	private async discoverStandaloneProjectUris(
		workspaces: WorkspaceListEntry[],
	): Promise<string[]> {
		const inWorkspace = new Set<string>();
		for (const ws of workspaces) {
			for (const member of ws.members) {
				if (member.uri?.trim()) {
					inWorkspace.add(member.uri);
				}
			}
		}
		const files = await vscode.workspace.findFiles(
			"**/*.bproj",
			"**/target/**",
			300,
		);
		return files
			.filter((uri) => !inWorkspace.has(uri.toString()))
			.map((uri) => uri.toString());
	}
}
