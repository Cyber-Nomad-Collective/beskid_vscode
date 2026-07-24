import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { GraphExplorerPanel } from "../graphs/GraphExplorerPanel.js";
import type { GraphKindId } from "../graphs/lspGraphTypes.js";
import {
	isManifestUri,
	isProjectManifestUri,
	isWorkspaceManifestUri,
} from "../workspace/manifestPath.js";
import type { ProjectsTreeItem } from "../workspace/ProjectsTreeItem.js";

function projectUriFromTreeItem(item: unknown): vscode.Uri | undefined {
	if (!item || typeof item !== "object" || !("projectUri" in item)) {
		return undefined;
	}
	const uri = (item as ProjectsTreeItem).projectUri;
	return uri ? vscode.Uri.parse(uri) : undefined;
}

function workspaceUriFromTreeItem(item: unknown): string | undefined {
	if (!item || typeof item !== "object" || !("workspaceUri" in item)) {
		return undefined;
	}
	return (item as ProjectsTreeItem).workspaceUri;
}

function manifestUriFromEditor(): vscode.Uri | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return undefined;
	}
	const path = editor.document.uri.fsPath;
	if (isManifestUri(path)) {
		return editor.document.uri;
	}
	return undefined;
}

export function registerGraphCommands(
	context: ExtensionContext,
	panel: GraphExplorerPanel,
): void {
	const openFromTree = async (kind: GraphKindId, item?: unknown) => {
		const workspaceUri = workspaceUriFromTreeItem(item);
		if (workspaceUri) {
			panel.setWorkspaceUri(workspaceUri);
		}
		if (kind === "workspace" && workspaceUri) {
			await panel.open(kind, vscode.Uri.parse(workspaceUri));
			return;
		}
		const projectUri =
			projectUriFromTreeItem(item) ??
			manifestUriFromEditor() ??
			vscode.window.activeTextEditor?.document.uri;
		if (
			projectUri &&
			(isProjectManifestUri(projectUri.fsPath) ||
				isWorkspaceManifestUri(projectUri.fsPath))
		) {
			await panel.open(kind, projectUri);
			return;
		}
		await panel.open(kind);
	};

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"beskid.showGraph.project",
			(item?: unknown) => openFromTree("projectDeps", item),
		),
		vscode.commands.registerCommand(
			"beskid.showGraph.workspace",
			(item?: unknown) => openFromTree("workspace", item),
		),
		vscode.commands.registerCommand("beskid.showGraph.module", () =>
			panel.open("moduleTree"),
		),
		vscode.commands.registerCommand("beskid.showGraph.imports", () =>
			panel.open("importClosure"),
		),
		vscode.commands.registerCommand("beskid.showGraph.host", () =>
			panel.open("hostComposition"),
		),
		vscode.commands.registerCommand(
			"beskid.showGraph",
			(kind?: GraphKindId, uri?: vscode.Uri) =>
				panel.open(kind ?? "projectDeps", uri),
		),
		vscode.commands.registerCommand("beskid.refreshGraph", () => panel.refresh()),
	);
}
