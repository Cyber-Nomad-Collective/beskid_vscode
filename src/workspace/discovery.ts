import { dirname } from "node:path";
import * as vscode from "vscode";
import { readAutoSelectFromEditor } from "../config/workspaceSettings.js";
import {
	discoverProjectFileFromPath,
	isManifestUri,
	isProjectManifestUri,
} from "./manifestPath.js";

export { discoverProjectFileFromPath } from "./manifestPath.js";

export async function resolveProjectUriForEditor(
	document: vscode.TextDocument,
): Promise<vscode.Uri | undefined> {
	if (
		document.languageId === "beskid-manifest" ||
		isManifestUri(document.fileName)
	) {
		if (isProjectManifestUri(document.fileName)) {
			return document.uri;
		}
	}
	const discovered = discoverProjectFileFromPath(document.uri.fsPath);
	if (discovered) {
		return vscode.Uri.file(discovered);
	}
	const files = await vscode.workspace.findFiles(
		new vscode.RelativePattern(dirname(document.uri.fsPath), "*.bproj"),
		"**/target/**",
		2,
	);
	if (files.length === 1) {
		return files[0];
	}
	const upward = await vscode.workspace.findFiles(
		"**/*.bproj",
		"**/{target,node_modules,.git,obj}/**",
		50,
	);
	const docDir = dirname(document.uri.fsPath);
	let best: vscode.Uri | undefined;
	let bestLen = -1;
	for (const candidate of upward) {
		const root = dirname(candidate.fsPath);
		if (docDir.startsWith(root) && root.length > bestLen) {
			best = candidate;
			bestLen = root.length;
		}
	}
	return best;
}

export function readAutoSelectFromEditorEnabled(): boolean {
	return readAutoSelectFromEditor();
}
