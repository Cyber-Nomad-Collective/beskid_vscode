import * as vscode from "vscode";
import { FOCUSED_PROJECT_KEY, SELECTED_PROJECT_KEY } from "../constants.js";

export type FocusedProjectState = {
	projectUri: vscode.Uri | undefined;
};

function parseFocusedUri(value: string | undefined): vscode.Uri | undefined {
	if (!value) {
		return undefined;
	}
	try {
		return vscode.Uri.parse(value);
	} catch {
		return undefined;
	}
}

export function loadFocusedProject(
	context: vscode.ExtensionContext,
): vscode.Uri | undefined {
	const focused = context.workspaceState.get<string>(FOCUSED_PROJECT_KEY);
	if (focused) {
		return parseFocusedUri(focused);
	}

	const legacy = context.workspaceState.get<string>(SELECTED_PROJECT_KEY);
	if (!legacy) {
		return undefined;
	}

	void context.workspaceState.update(FOCUSED_PROJECT_KEY, legacy);
	void context.workspaceState.update(SELECTED_PROJECT_KEY, undefined);
	return parseFocusedUri(legacy);
}

export async function saveFocusedProject(
	context: vscode.ExtensionContext,
	uri: vscode.Uri | undefined,
): Promise<void> {
	const serialized = uri?.toString();
	await context.workspaceState.update(FOCUSED_PROJECT_KEY, serialized);
}
