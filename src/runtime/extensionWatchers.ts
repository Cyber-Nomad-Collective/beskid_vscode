import * as vscode from "vscode";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";

export function registerExtensionWatchers(
  context: vscode.ExtensionContext,
  refresh: RefreshCoordinator,
  onManifestChange?: () => void,
): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/{*.bd,*.proj,Project.lock,workspace.package.json}",
  );
  const scheduleRefresh = () => {
    refresh.scheduleDebouncedFull();
    onManifestChange?.();
  };
  watcher.onDidChange(scheduleRefresh, undefined, context.subscriptions);
  watcher.onDidCreate(scheduleRefresh, undefined, context.subscriptions);
  watcher.onDidDelete(scheduleRefresh, undefined, context.subscriptions);
  context.subscriptions.push(watcher);
}
