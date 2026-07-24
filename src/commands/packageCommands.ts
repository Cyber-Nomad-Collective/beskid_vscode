import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { storePckgApiKey } from "../config/workspaceSettings.js";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { PackageTreeItem } from "../packages/PackageTreeItem.js";
import type { PckgService } from "../packages/pckgService.js";

function payloadFromItem(item: unknown): Record<string, unknown> | undefined {
	if (item && typeof item === "object" && "payload" in item) {
		return (item as PackageTreeItem).payload;
	}
	return undefined;
}

function packageNameFromArg(item: unknown): string | undefined {
	if (typeof item === "string") {
		return item;
	}
	if (item && typeof item === "object" && "packageName" in item) {
		const name = (item as PackageTreeItem).packageName;
		return typeof name === "string" ? name : undefined;
	}
	return undefined;
}

export function registerPackageCommands(
	context: ExtensionContext,
	deps: {
		packageProvider: PackageManagerProvider;
		pckg: PckgService;
		refresh: RefreshCoordinator;
		openRegistryPanel?: () => void | Promise<void>;
	},
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand("beskid.packages.open", () =>
			deps.openRegistryPanel?.(),
		),
		vscode.commands.registerCommand("beskid.packages.search", async () => {
			await deps.openRegistryPanel?.();
			const query = await vscode.window.showInputBox({
				prompt: "Search packages",
				placeHolder: "package name or category…",
			});
			if (query !== undefined && query.trim().length > 0) {
				await vscode.commands.executeCommand(
					"beskid.packages.registrySearch",
					query.trim(),
				);
			}
		}),
		vscode.commands.registerCommand(
			"beskid.packages.showDetails",
			(item?: unknown) => {
				const pkg = packageNameFromArg(item);
				if (pkg) {
					void vscode.commands.executeCommand("beskid.packages.registrySelect", pkg);
				}
			},
		),
		vscode.commands.registerCommand("beskid.packages.addDependency", () =>
			deps.packageProvider.addDependency(),
		),
		vscode.commands.registerCommand("beskid.packages.refresh", async () => {
			deps.packageProvider.clearCaches();
			await deps.refresh.scheduleFull();
			deps.packageProvider.refresh();
		}),
		vscode.commands.registerCommand(
			"beskid.packages.configureApiKey",
			async () => {
				const key = await vscode.window.showInputBox({
					prompt: "Package registry API key (Bearer)",
					password: true,
					ignoreFocusOut: true,
				});
				if (key === undefined) {
					return;
				}
				const trimmed = key.trim();
				await storePckgApiKey(context, trimmed.length > 0 ? trimmed : undefined);
				deps.packageProvider.clearCaches();
				if (trimmed.length > 0) {
					const validation = await deps.pckg.validateConnection(trimmed);
					if (validation.ok) {
						void vscode.window.showInformationMessage(
							"Registry connection validated.",
						);
					} else {
						void vscode.window.showWarningMessage(
							validation.error ??
								validation.validation.message ??
								"Registry validation failed.",
						);
					}
				}
				await deps.packageProvider.refreshProjectSection();
			},
		),
		vscode.commands.registerCommand(
			"beskid.packages.openManifest",
			async (item?: unknown) => {
				const payload = payloadFromItem(item);
				const uri = payload?.projectUri as string | undefined;
				if (!uri) {
					void vscode.window.showWarningMessage(
						"No project manifest path for this dependency.",
					);
					return;
				}
				await vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(uri));
			},
		),
		vscode.commands.registerCommand(
			"beskid.packages.openMaterializedFolder",
			async (item?: unknown) => {
				const payload = payloadFromItem(item);
				const p = (payload?.materializedPath as string | undefined)?.trim();
				if (!p) {
					void vscode.window.showWarningMessage(
						"No materialized folder path for this dependency.",
					);
					return;
				}
				const folder = vscode.Uri.file(p);
				try {
					await vscode.commands.executeCommand("revealInExplorer", folder);
				} catch {
					await vscode.commands.executeCommand("vscode.open", folder);
				}
			},
		),
		vscode.commands.registerCommand(
			"beskid.packages.copyDependencyLabel",
			async (item?: unknown) => {
				const payload = payloadFromItem(item);
				const label =
					(payload?.label as string | undefined) ??
					(typeof item === "object" && item && "label" in item
						? String((item as PackageTreeItem).label)
						: undefined);
				if (label) {
					await vscode.env.clipboard.writeText(label);
				}
			},
		),
		vscode.commands.registerCommand(
			"beskid.packages.openRegistryUri",
			async (uri: unknown) => {
				if (
					typeof uri !== "string" ||
					(!uri.startsWith("http://") && !uri.startsWith("https://"))
				) {
					return;
				}
				await vscode.env.openExternal(vscode.Uri.parse(uri));
			},
		),
	);
}
