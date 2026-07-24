import { dirname } from "node:path";
import * as vscode from "vscode";
import type { GraphNodeSummary } from "../graphs/lspGraphTypes.js";
import { readProjectManifestSnapshot } from "./bsolManifestReader.js";
import type { LspProjectApi } from "./lspProjectApi.js";
import { ProjectsTreeItem } from "./ProjectsTreeItem.js";
import { themeIcon } from "./tree/treeItemHelpers.js";

const DEPENDENCY_KINDS = new Set(["path", "git", "registry"]);

export type ProjectSectionChildrenResult = {
	items: ProjectsTreeItem[];
	error?: string;
};

function truncateMessage(message: string, max = 120): string {
	const trimmed = message.trim();
	if (trimmed.length <= max) {
		return trimmed;
	}
	return `${trimmed.slice(0, max - 1)}…`;
}

function warningItem(projectUri: string, message: string): ProjectsTreeItem {
	const item = new ProjectsTreeItem(
		"warning",
		truncateMessage(message),
		vscode.TreeItemCollapsibleState.None,
		projectUri,
	);
	item.command = { command: "beskid.lsp.openLogs", title: "Open LSP logs" };
	return item;
}

function unresolvedLabels(
	nodes: GraphNodeSummary[],
	warnings: Array<{ code: string; message: string }> = [],
): string[] {
	const labels = warnings
		.filter((warning) => warning.code === "unresolved")
		.map((warning) => warning.message);
	for (const node of nodes) {
		if (node.unresolved) {
			labels.push(node.label);
		}
	}
	return [...new Set(labels)];
}

/** Degraded fallback: parse `.bproj` on disk when LSP explorer commands fail or return no data. */
function manifestFallback(projectUri: string) {
	return readProjectManifestSnapshot(vscode.Uri.parse(projectUri).fsPath);
}

export async function projectSectionItems(
	_lspApi: LspProjectApi,
	projectUri: string,
): Promise<ProjectsTreeItem[]> {
	const targets = new ProjectsTreeItem(
		"section",
		"Targets",
		vscode.TreeItemCollapsibleState.Collapsed,
		projectUri,
		"targets",
	);
	targets.iconPath = themeIcon("symbol-method");

	const deps = new ProjectsTreeItem(
		"section",
		"Dependencies",
		vscode.TreeItemCollapsibleState.Collapsed,
		projectUri,
		"dependencies",
	);
	deps.iconPath = themeIcon("package");

	const sources = new ProjectsTreeItem(
		"section",
		"Source folders",
		vscode.TreeItemCollapsibleState.Collapsed,
		projectUri,
		"sources",
	);
	sources.iconPath = themeIcon("folder");

	return [targets, deps, sources];
}

export async function projectSectionChildren(
	lspApi: LspProjectApi,
	projectUri: string,
	section: "targets" | "dependencies" | "sources",
	workspaceUri?: string,
): Promise<ProjectSectionChildrenResult> {
	const focused = vscode.Uri.parse(projectUri);
	const graphOptions = workspaceUri ? { workspaceUri } : undefined;

	if (section === "targets") {
		const graphOutcome = await lspApi.getGraph(
			projectUri,
			"projectDeps",
			graphOptions,
		);
		if (!graphOutcome.ok) {
			const fallback = manifestFallback(projectUri);
			if (fallback && fallback.targets.length > 0) {
				return {
					items: fallback.targets.map((target) => {
						const item = new ProjectsTreeItem(
							"target",
							target.name,
							vscode.TreeItemCollapsibleState.None,
							projectUri,
						);
						item.description = "manifest";
						item.iconPath = themeIcon("symbol-method");
						return item;
					}),
					error: graphOutcome.error,
				};
			}
			return {
				items: [warningItem(projectUri, graphOutcome.error)],
				error: graphOutcome.error,
			};
		}

		const nodes = graphOutcome.value.metadata.nodes ?? [];
		const rootNode = nodes.find((node) => node.kind === "root");
		if (rootNode) {
			const item = new ProjectsTreeItem(
				"target",
				`${rootNode.label} (${rootNode.kind})`,
				vscode.TreeItemCollapsibleState.None,
				projectUri,
			);
			item.iconPath = themeIcon("symbol-method");
			return { items: [item] };
		}

		const fallback = manifestFallback(projectUri);
		if (fallback && fallback.targets.length > 0) {
			return {
				items: fallback.targets.map((target) => {
					const item = new ProjectsTreeItem(
						"target",
						target.name,
						vscode.TreeItemCollapsibleState.None,
						projectUri,
					);
					item.description = "manifest";
					item.iconPath = themeIcon("symbol-method");
					return item;
				}),
			};
		}

		const item = new ProjectsTreeItem(
			"target",
			"Project",
			vscode.TreeItemCollapsibleState.None,
			projectUri,
		);
		item.iconPath = themeIcon("symbol-method");
		return { items: [item] };
	}

	if (section === "dependencies") {
		const items: ProjectsTreeItem[] = [];
		let sectionError: string | undefined;

		const depsOutcome = await lspApi.getProjectDependencies(projectUri);
		if (!depsOutcome.ok) {
			sectionError = depsOutcome.error;
		} else {
			const data = depsOutcome.value;
			for (const dep of data.declared) {
				const label = dep.version ? `${dep.name}@${dep.version}` : dep.name;
				const item = new ProjectsTreeItem(
					"dep",
					label,
					vscode.TreeItemCollapsibleState.None,
					projectUri,
				);
				item.description = dep.source ?? "declared";
				item.iconPath = themeIcon("package");
				items.push(item);
			}
			for (const name of data.unresolved) {
				const item = new ProjectsTreeItem(
					"dep",
					name,
					vscode.TreeItemCollapsibleState.None,
					projectUri,
					undefined,
					true,
				);
				item.description = "unresolved";
				item.iconPath = themeIcon("warning");
				items.push(item);
			}
		}

		if (items.length === 0) {
			const graphOutcome = await lspApi.getGraph(
				projectUri,
				"projectDeps",
				graphOptions,
			);
			if (!graphOutcome.ok) {
				sectionError = sectionError ?? graphOutcome.error;
			} else {
				const payload = graphOutcome.value;
				const nodes = payload.metadata.nodes ?? [];
				for (const node of nodes) {
					if (node.kind === "root" || !DEPENDENCY_KINDS.has(node.kind)) {
						continue;
					}
					const item = new ProjectsTreeItem(
						"dep",
						node.label,
						vscode.TreeItemCollapsibleState.None,
						projectUri,
						undefined,
						node.unresolved,
					);
					item.description = node.kind;
					item.iconPath = node.unresolved
						? themeIcon("warning")
						: themeIcon("package");
					if (node.uri) {
						item.resourceUri = vscode.Uri.parse(node.uri);
					}
					items.push(item);
				}
				for (const label of unresolvedLabels(nodes, payload.warnings)) {
					const item = new ProjectsTreeItem(
						"dep",
						label,
						vscode.TreeItemCollapsibleState.None,
						projectUri,
						undefined,
						true,
					);
					item.description = "unresolved";
					item.iconPath = themeIcon("warning");
					items.push(item);
				}
			}
		}

		if (items.length === 0) {
			const fallback = manifestFallback(projectUri);
			for (const dep of fallback?.dependencies ?? []) {
				const label = dep.version ? `${dep.name}@${dep.version}` : dep.name;
				const item = new ProjectsTreeItem(
					"dep",
					label,
					vscode.TreeItemCollapsibleState.None,
					projectUri,
				);
				item.description = dep.source ?? "manifest";
				item.iconPath = themeIcon("package");
				items.push(item);
			}
		}

		if (items.length === 0 && sectionError) {
			return {
				items: [warningItem(projectUri, sectionError)],
				error: sectionError,
			};
		}

		return { items, error: sectionError };
	}

	const roots = new Set<string>();
	const rootDir = dirname(focused.fsPath);
	const pattern = new vscode.RelativePattern(rootDir, "**/*.bd");
	const files = await vscode.workspace.findFiles(pattern, "**/target/**", 40);
	for (const file of files) {
		roots.add(dirname(file.fsPath));
	}
	return {
		items: [...roots].sort().map((dir) => {
			const item = new ProjectsTreeItem(
				"folder",
				vscode.workspace.asRelativePath(vscode.Uri.file(dir)),
				vscode.TreeItemCollapsibleState.None,
				projectUri,
			);
			item.resourceUri = vscode.Uri.file(dir);
			item.iconPath = themeIcon("folder");
			return item;
		}),
	};
}
