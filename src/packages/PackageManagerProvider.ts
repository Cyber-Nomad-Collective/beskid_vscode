import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import type { CliService } from "../cli/cliService.js";
import { ContextValue, themeIcon } from "../workspace/tree/treeItemHelpers.js";
import type { LspProjectApi } from "../workspace/lspProjectApi.js";
import { promptAndAddDependency } from "./dependencyEditor.js";
import type { PckgActivityReporter } from "./pckgActivity.js";
export type { PckgActivityPhase } from "./pckgActivity.js";
import type { PackageDetails, PackageSearchRow } from "./pckgTypes.js";
import { PackageTreeItem } from "./PackageTreeItem.js";
import type { PckgService } from "./pckgService.js";

const SEARCH_DEBOUNCE_MS = 300;

export type PackageManagerDeps = {
  context: ExtensionContext;
  pckg: PckgService;
  getFocusedProjectUri: () => vscode.Uri | undefined;
  lspApi: LspProjectApi;
  reportActivity: PckgActivityReporter;
  cli: CliService;
  refreshUi: () => Promise<void>;
};

export class PackageManagerProvider implements vscode.TreeDataProvider<PackageTreeItem> {
  private readonly emitter = new vscode.EventEmitter<PackageTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private searchQuery = "";
  private searchDebounceTimer: NodeJS.Timeout | undefined;
  private searchResults: PackageSearchRow[] | undefined;
  private searchError: string | undefined;
  private searchNeedsApiKey = false;
  private connectionStatusLabel: string | undefined;
  private detailsCache = new Map<string, PackageDetails>();

  constructor(private readonly deps: PackageManagerDeps) {}

  setQuery(query: string): void {
    this.searchQuery = query;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => void this.runSearch(), SEARCH_DEBOUNCE_MS);
    this.refresh();
  }

  clearCaches(): void {
    this.deps.pckg.clearCaches();
    this.detailsCache.clear();
    this.searchResults = undefined;
    this.searchError = undefined;
    this.searchNeedsApiKey = false;
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
    const auth = status.authConfigured ? "auth configured" : "no API key";
    if (status.connected) {
      this.connectionStatusLabel = `Connected · ${url} · ${auth}`;
    } else if (status.validation.status === "error" && status.validation.message) {
      this.connectionStatusLabel = `Not connected · ${url} · ${status.validation.message}`;
    } else {
      this.connectionStatusLabel = `Not connected · ${url} · ${auth}`;
    }
    this.refresh();
  }

  async showDetailsForPackage(packageName: string): Promise<void> {
    this.deps.reportActivity("details", true, packageName);
    const result = await this.deps.pckg.getDetails(packageName);
    this.deps.reportActivity("details", false);
    if (!result.ok) {
      if (result.needsApiKey) {
        void vscode.window.showWarningMessage(
          `${result.error} Run “Beskid: Configure Package Registry API Key”.`,
        );
      } else {
        void vscode.window.showWarningMessage(result.error);
      }
      return;
    }
    this.detailsCache.set(packageName, result.data);
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
      case "section":
        element.iconPath = themeIcon(element.section === "ThisProject" ? "folder-library" : "cloud");
        break;
      case "declared":
      case "locked":
      case "package":
        element.iconPath = themeIcon("package");
        break;
      case "unresolved":
        element.iconPath = themeIcon("warning");
        break;
      case "version":
        element.iconPath = element.payload?.yanked ? themeIcon("error") : themeIcon("tag");
        break;
      case "dependency":
        element.iconPath = themeIcon("references");
        break;
      case "searchAction":
        element.iconPath = themeIcon("search");
        break;
      case "readme":
        element.iconPath = themeIcon("book");
        break;
      default:
        break;
    }
    return element;
  }

  async getChildren(element?: PackageTreeItem): Promise<PackageTreeItem[]> {
    if (!element) {
      return [
        new PackageTreeItem("section", "ThisProject", "This project", vscode.TreeItemCollapsibleState.Expanded),
        new PackageTreeItem("section", "RegistrySearch", "Registry search", vscode.TreeItemCollapsibleState.Expanded),
      ];
    }
    if (element.nodeType === "section" && element.section === "ThisProject") {
      return this.getThisProjectChildren();
    }
    if (element.nodeType === "section" && element.section === "RegistrySearch") {
      return this.getRegistrySearchChildren();
    }
    if (element.nodeType === "package" && element.packageName) {
      return this.getRegistryPackageChildren(element.packageName);
    }
    return [];
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
        arguments: [{ projectUri: projectUri.toString(), label }],
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

  private getRegistrySearchChildren(): PackageTreeItem[] {
    const items: PackageTreeItem[] = [];
    if (this.connectionStatusLabel) {
      const statusItem = new PackageTreeItem(
        "info",
        "RegistrySearch",
        this.connectionStatusLabel,
        vscode.TreeItemCollapsibleState.None,
      );
      statusItem.iconPath = themeIcon(
        this.connectionStatusLabel.startsWith("Connected") ? "pass" : "warning",
      );
      items.push(statusItem);
    } else {
      void this.refreshConnectionStatus();
    }

    const q = this.searchQuery.trim();
    if (!q) {
      const hint = new PackageTreeItem("searchAction", "RegistrySearch", "Search…", vscode.TreeItemCollapsibleState.None);
      hint.command = { command: "beskid.packages.search", title: "Search" };
      items.push(hint);
      return items;
    }
    if (this.searchError) {
      const err = new PackageTreeItem("info", "RegistrySearch", this.searchError, vscode.TreeItemCollapsibleState.None);
      if (this.searchNeedsApiKey) {
        err.command = { command: "beskid.packages.configureApiKey", title: "Configure API key" };
      } else {
        err.command = { command: "beskid.packages.refresh", title: "Retry" };
      }
      items.push(err);
      return items;
    }
    if (!this.searchResults) {
      items.push(
        new PackageTreeItem("info", "RegistrySearch", `Searching “${q}”…`, vscode.TreeItemCollapsibleState.None),
      );
      return items;
    }
    if (this.searchResults.length === 0) {
      items.push(
        new PackageTreeItem("info", "RegistrySearch", "No matches.", vscode.TreeItemCollapsibleState.None),
      );
      return items;
    }
    items.push(
      ...this.searchResults.map((hit) => {
      const name = hit.package.name;
      const item = new PackageTreeItem(
        "package",
        "RegistrySearch",
        name,
        vscode.TreeItemCollapsibleState.Collapsed,
        name,
      );
      item.description = hit.package.category;
      item.tooltip = hit.package.description?.trim() || name;
      item.contextValue = ContextValue.registryPackage;
      return item;
      }),
    );
    return items;
  }

  private async getRegistryPackageChildren(packageName: string): Promise<PackageTreeItem[]> {
    let details = this.detailsCache.get(packageName);
    if (!details) {
      this.deps.reportActivity("details", true, packageName);
      const result = await this.deps.pckg.getDetails(packageName);
      this.deps.reportActivity("details", false);
      if (!result.ok) {
        const msg = new PackageTreeItem(
          "info",
          "RegistrySearch",
          result.error,
          vscode.TreeItemCollapsibleState.None,
          packageName,
        );
        if (result.needsApiKey) {
          msg.command = { command: "beskid.packages.configureApiKey", title: "Configure API key" };
        }
        return [msg];
      }
      details = result.data;
      this.detailsCache.set(packageName, details);
    }
    const items: PackageTreeItem[] = [];
    if (details.readme?.trim()) {
      const lines = details.readme.trim().split(/\r?\n/).slice(0, 3);
      const readme = new PackageTreeItem(
        "readme",
        "RegistrySearch",
        lines.join(" ").slice(0, 120),
        vscode.TreeItemCollapsibleState.None,
        packageName,
      );
      readme.tooltip = details.readme;
      items.push(readme);
    }
    for (const ver of details.versions.slice(0, 20)) {
      const item = new PackageTreeItem(
        "version",
        "RegistrySearch",
        ver.version,
        vscode.TreeItemCollapsibleState.None,
        packageName,
        ver.version,
        { yanked: ver.isYanked },
      );
      item.description = ver.isYanked ? "yanked" : ver.publishedAtUtc;
      items.push(item);
    }
    for (const dep of details.dependencies) {
      const label = dep.version ? `${dep.name}@${dep.version}` : dep.name;
      items.push(
        new PackageTreeItem("dependency", "RegistrySearch", label, vscode.TreeItemCollapsibleState.None, packageName, dep.version),
      );
    }
    const base = await this.deps.pckg.resolveRegistryBaseUrl();
    const open = new PackageTreeItem("info", "RegistrySearch", "Open in browser", vscode.TreeItemCollapsibleState.None, packageName);
    open.command = {
      command: "beskid.packages.openRegistryUri",
      title: "Open",
      arguments: [this.deps.pckg.buildPackageUrl(base, packageName)],
    };
    items.push(open);
    return items;
  }

  private async runSearch(): Promise<void> {
    const q = this.searchQuery.trim();
    if (!q) {
      this.searchResults = undefined;
      this.searchError = undefined;
      this.searchNeedsApiKey = false;
      this.refresh();
      return;
    }
    this.deps.reportActivity("search", true, `Searching “${q}”…`);
    const result = await this.deps.pckg.search(q, 50);
    this.deps.reportActivity("search", false);
    if (!result.ok) {
      this.searchResults = undefined;
      this.searchError = result.error;
      this.searchNeedsApiKey = result.needsApiKey ?? false;
    } else {
      this.searchResults = result.rows;
      this.searchError = undefined;
      this.searchNeedsApiKey = false;
    }
    this.refresh();
  }
}
