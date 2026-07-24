import * as vscode from "vscode";
import type { ProjectsTreeItem } from "./ProjectsTreeItem.js";
import { resolveFocusManifestPath } from "./resolveFocusManifestPath.js";

export type FocusTargetInput =
	| vscode.Uri
	| string
	| ProjectsTreeItem
	| undefined;

/** Resolve a focus target to a `.bproj` manifest URI, if possible. */
export function resolveFocusTarget(
	input: FocusTargetInput,
): vscode.Uri | undefined {
	if (
		input &&
		typeof input === "object" &&
		"scheme" in input &&
		"fsPath" in input
	) {
		const path = resolveFocusManifestPath(input.fsPath);
		if (!path) {
			return undefined;
		}
		if (input.scheme === "file" && input.fsPath.replaceAll("\\", "/") === path) {
			return input;
		}
		return vscode.Uri.file(path);
	}

	const path = resolveFocusManifestPath(input);
	return path ? vscode.Uri.file(path) : undefined;
}
