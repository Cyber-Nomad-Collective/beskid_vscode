import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { CliService } from "../cli/cliService.js";
import { ContextValue, themeIcon } from "../workspace/tree/treeItemHelpers.js";
import type { LspProjectApi } from "../workspace/lspProjectApi.js";
import { promptAndAddDependency } from "./dependencyEditor.js";
import type { PckgActivityReporter } from "./pckgActivity.js";
export type { PckgActivityPhase } from "./pckgActivity.js";
import { PackageTreeItem } from "./PackageTreeItem.js";
import type { PckgService } from "./pckgService.js";

export type PackageManagerDeps = {
  context: ExtensionContext;
  pckg: PckgService;
  getFocusedProjectUri: () => vscode.Uri | undefined;
  lspApi: LspProjectApi;
  reportActivity: PckgActivityReporter;
  cli: CliService;
  refreshUi: () => Promise<void>;
};

/** Sidebar tree: focused project dependencies only. Registry browse uses PackageRegistryPanel. */
export class PackageManagerProvider implements vscode.TreeDataProvider<PackageTreeItem> {
  private readonly emitter = new vscode.EventEmitter<PackageTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private connectionStatusLabel: string | undefined;

  constructor(private readonly deps: PackageManagerDeps) {}

  clearCaches(): void {
    this.deps.pckg.clearCaches();
    this.connectionStatusLabel = undefined;
  }

  refresh(): void {
    this.emitter.fire();
  }

  async refreshProjectSection(): Promise<void> {
    void this.refreshConnectionStatus();
    this.refresh();
  }

  private async refreshConnectionStatus(): Promise<void> {
    const status = await this.deps.pckg.getConnectionStatus(true);
    const url = status.baseUrl || status.workspaceDefaultRegistryUrl || "not configured";
    if (status.connected) {
      const authNote = status.authConfigured ? "auth configured" : "public catalog";
      this.connectionStatusLabel = `Connected · ${url} · ${authNote}`;
    } else if (status.validation.status === "error" && status.validation.message) {
      this.connectionStatusLabel = `${url} · ${status.validation.message}`;
    } else {
      this.connectionStatusLabel = `Public catalog · ${url}`;
    }
    this.refresh();
  }

  async runFetch(): Promise<void> {
    if (!this.deps.getFocusedProjectUri()) {
      void vscode.window.showWarningMessage("Focus a project first.");
      return;
    }
    const code = await this.deps.cli.run("fetch");
    if (code === 0) {
      await this.deps.refreshUi();
    }
  }

  async runLock(): Promise<void> {
    if (!this.deps.getFocusedProjectUri()) {
      void vscode.window.showWarningMessage("Focus a project first.");
      return;
    }
    const code = await this.deps.cli.run("lock");
    if (code === 0) {
      await this.deps.refreshUi();
    }
  }

  async addDependency(): Promise<void> {
    const projectUri = this.deps.getFocusedProjectUri();
    if (!projectUri) {
      void vscode.window.showWarningMessage("Focus a project first.");
      return;
    }
    const ok = await promptAndAddDependency(projectUri);
    if (ok) {
      await this.deps.refreshUi();
    }
  }

  getTreeItem(element: PackageTreeItem): vscode.TreeItem {
    switch (element.nodeType) {
      case "declared":
      case "locked":
        element.iconPath = themeIcon("package");
        break;
      case "unresolved":
        element.iconPath = themeIcon("warning");
        break;
      case "searchAction":
        element.iconPath = themeIcon("cloud-download");
        break;
      default:
        break;
    }
    return element;
  }

  async getChildren(element?: PackageTreeItem): Promise<PackageTreeItem[]> {
    if (!element) {
      return this.getRootChildren();
    }
    return [];
  }

  private async getRootChildren(): Promise<PackageTreeItem[]> {
    const items: PackageTreeItem[] = [];

    if (this.connectionStatusLabel) {
      const statusItem = new PackageTreeItem(
        "info",
        "ThisProject",
        this.connectionStatusLabel,
        vscode.TreeItemCollapsibleState.None,
      );
      statusItem.iconPath = themeIcon(
        this.connectionStatusLabel.startsWith("Connected") ? "pass" : "info",
      );
      items.push(statusItem);
    } else {
      void this.refreshConnectionStatus();
    }

    const browse = new PackageTreeItem(
      "searchAction",
      "ThisProject",
      "Browse registry…",
      vscode.TreeItemCollapsibleState.None,
    );
    browse.command = { command: "beskid.packages.open", title: "Browse registry" };
    items.push(browse);

    items.push(...(await this.getThisProjectChildren()));
    return items;
  }

  private async getThisProjectChildren(): Promise<PackageTreeItem[]> {
    const projectUri = this.deps.getFocusedProjectUri();
    if (!projectUri) {
      return [
        new PackageTreeItem("info", "ThisProject", "Focus a project first.", vscode.TreeItemCollapsibleState.None),
      ];
    }
    const deps = await this.deps.lspApi.getProjectDependencies(projectUri.toString());
    if (!deps) {
      return [
        new PackageTreeItem(
          "info",
          "ThisProject",
          "Dependencies unavailable (start LSP).",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }
    const lockedNames = new Set(deps.locked.map((d) => d.name.toLowerCase()));
    const items: PackageTreeItem[] = [];
    for (const dep of deps.declared) {
      const label = dep.version ? `${dep.name}@${dep.version}` : dep.name;
      const item = new PackageTreeItem(
        "declared",
        "ThisProject",
        label,
        vscode.TreeItemCollapsibleState.None,
        dep.name,
        undefined,
        {
          projectUri: projectUri.toString(),
          materializedPath: deps.locked.find((l) => l.name === dep.name)?.materializedPath,
          label,
        },
      );
      item.description = dep.source;
      if (!lockedNames.has(dep.name.toLowerCase())) {
        item.description = [item.description, "not locked"].filter(Boolean).join(" · ");
      }
      item.contextValue = ContextValue.localDependency;
      item.command = {
        command: "beskid.packages.openManifest",
        title: "Open manifest",
        arguments: [item],
      };
      items.push(item);
    }
    for (const dep of deps.locked) {
      if (deps.declared.some((d) => d.name.toLowerCase() === dep.name.toLowerCase())) {
        continue;
      }
      const label = dep.version ? `${dep.name}@${dep.version}` : dep.name;
      const item = new PackageTreeItem(
        "locked",
        "ThisProject",
        label,
        vscode.TreeItemCollapsibleState.None,
        dep.name,
        undefined,
        {
          projectUri: projectUri.toString(),
          materializedPath: dep.materializedPath,
          label,
        },
      );
      item.description = dep.registry ?? "lock";
      item.tooltip = dep.materializedPath;
      item.contextValue = ContextValue.localDependency;
      items.push(item);
    }
    for (const u of deps.unresolved) {
      const name = typeof u === "string" ? u : String(u);
      const item = new PackageTreeItem("unresolved", "ThisProject", name, vscode.TreeItemCollapsibleState.None, name);
      item.contextValue = ContextValue.unresolvedDependency;
      items.push(item);
    }
    if (items.length === 0) {
      items.push(
        new PackageTreeItem("info", "ThisProject", "No dependencies.", vscode.TreeItemCollapsibleState.None),
      );
    }
    return items;
  }
}
