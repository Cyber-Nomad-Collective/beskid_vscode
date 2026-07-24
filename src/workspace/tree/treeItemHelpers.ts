import * as vscode from "vscode";

export const ContextValue = {
	workspace: "beskidWorkspace",
	workspaceMember: "beskidWorkspaceMember",
	standaloneProject: "beskidStandaloneProject",
	localDependency: "beskidLocalDependency",
	unresolvedDependency: "beskidUnresolvedDependency",
	registryPackage: "beskidRegistryPackage",
} as const;

export function prefixMultiRootLabel(name: string, uri: string): string {
	const multiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
	if (!multiRoot) {
		return name;
	}
	return `${name} (${vscode.workspace.asRelativePath(vscode.Uri.parse(uri))})`;
}

export function themeIcon(id: string): vscode.ThemeIcon {
	return new vscode.ThemeIcon(id);
}
