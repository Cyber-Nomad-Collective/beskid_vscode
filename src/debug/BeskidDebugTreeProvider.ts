import * as vscode from "vscode";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";
import type { LspRuntimeSnapshot } from "../runtime/lspRuntimeTypes.js";
import { formatDebugTreeValue, launchDebugRows, runtimeDebugRows } from "./debugTreeShape.js";

export type DebugSectionKey = "runtime" | "launch" | "workspace" | "settings" | "notification";

export type DebugTreeItem = vscode.TreeItem & {
  snapshotKey?: DebugSectionKey;
};

export class BeskidDebugTreeProvider implements vscode.TreeDataProvider<DebugTreeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();

  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly runtime: LspRuntimeState) {
    runtime.onDidChange(() => this.emitter.fire());
  }

  getTreeItem(element: DebugTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DebugTreeItem): DebugTreeItem[] {
    const snapshot = this.runtime.getSnapshot();
    if (!element) {
      return [
        section("Runtime", "runtime"),
        section("Launch", "launch"),
        section("Workspace", "workspace"),
        section("Settings", "settings"),
        section("Last notification", "notification"),
      ];
    }
    switch (element.snapshotKey) {
      case "runtime":
        return runtimeChildren(snapshot);
      case "launch":
        return launchChildren(snapshot);
      case "workspace":
        return workspaceChildren(snapshot);
      case "settings":
        return settingsChildren(snapshot);
      case "notification":
        return notificationChildren(snapshot);
      default:
        return [];
    }
  }
}

function section(label: string, key: DebugSectionKey): DebugTreeItem {
  return {
    label,
    snapshotKey: key,
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
  };
}

function leaf(label: string, value: string): DebugTreeItem {
  return {
    label: `${label}: ${value}`,
    collapsibleState: vscode.TreeItemCollapsibleState.None,
  };
}

function rowsToItems(rows: { label: string; value: string }[]): DebugTreeItem[] {
  return rows.map((row) => leaf(row.label, row.value));
}

function runtimeChildren(snapshot: LspRuntimeSnapshot): DebugTreeItem[] {
  return rowsToItems(runtimeDebugRows(snapshot));
}

function launchChildren(snapshot: LspRuntimeSnapshot): DebugTreeItem[] {
  return rowsToItems(launchDebugRows(snapshot));
}

function workspaceChildren(snapshot: LspRuntimeSnapshot): DebugTreeItem[] {
  const roots = snapshot.workspaceRoots;
  const items: DebugTreeItem[] = [
    leaf("Focused project", formatDebugTreeValue(snapshot.focusedProjectUri)),
    ...roots.map((root: string, index: number) => leaf(`Root ${index + 1}`, root)),
  ];
  if (roots.length === 0) {
    items.push(leaf("Roots", "no workspace folders"));
  }
  return items;
}

function settingsChildren(snapshot: LspRuntimeSnapshot): DebugTreeItem[] {
  const flags = snapshot.settingsFlags;
  return [
    leaf("devMode", String(flags.devMode)),
    leaf("preferBundled", String(flags.preferBundled)),
    leaf("lsp.releaseTag", flags.lspReleaseTag),
    leaf("explicitServerPath", flags.explicitServerPath || "(empty)"),
    leaf("cli.path", flags.configuredCliPath),
    leaf("cli.releaseTag", flags.cliReleaseTag),
    leaf("autoFetchDependencies", String(flags.autoFetchDependencies)),
    leaf("autoSelectFromEditor", String(flags.autoSelectFromEditor)),
    leaf("log.level", flags.logLevel),
    leaf("log.serverOutput", String(flags.logServerOutput)),
    leaf("pckg.baseUrl", flags.pckgBaseUrl),
  ];
}

function notificationChildren(snapshot: LspRuntimeSnapshot): DebugTreeItem[] {
  const last = snapshot.lastStatusNotification;
  if (!last) {
    return [leaf("beskid/status", "none yet")];
  }
  return [
    leaf("source", last.source),
    leaf("phase", last.phase),
    leaf("active", String(last.active)),
    leaf("message", formatDebugTreeValue(last.message)),
    leaf("progress", `${last.current ?? "?"}/${last.total ?? "?"}`),
  ];
}
