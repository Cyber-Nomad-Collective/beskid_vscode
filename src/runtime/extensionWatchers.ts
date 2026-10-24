import * as vscode from "vscode";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";
import { isExcludedWatchPath } from "./watchExclusions.js";

export function registerExtensionWatchers(
	context: vscode.ExtensionContext,
	refresh: RefreshCoordinator,
	onManifestChange?: () => void,
): void {
	const watcher = vscode.workspace.createFileSystemWatcher(
		"**/{*.bd,*.bproj,*.bws,Project.lock,workspace.package.json}",
	);
	const scheduleRefresh = (uri: vscode.Uri) => {
		// Cache writes and materialized corelib under obj/ must not drive a rescan.
		if (isExcludedWatchPath(uri.fsPath)) {
			return;
		}
		refresh.scheduleDebouncedFull();
		onManifestChange?.();
	};
	watcher.onDidChange(scheduleRefresh, undefined, context.subscriptions);
	watcher.onDidCreate(scheduleRefresh, undefined, context.subscriptions);
	watcher.onDidDelete(scheduleRefresh, undefined, context.subscriptions);
	context.subscriptions.push(watcher);
}
