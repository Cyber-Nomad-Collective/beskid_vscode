import { dirname } from "node:path";
import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import type { LspProjectApi } from "./lspProjectApi.js";
import { themeIcon } from "./tree/treeItemHelpers.js";

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    readonly nodeType:
      | "root"
      | "targets"
      | "target"
      | "dependencies"
      | "dep"
      | "sources"
      | "folder"
      | "info",
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    readonly uri?: vscode.Uri,
    readonly unresolved?: boolean,
  ) {
    super(label, collapsibleState);
  }
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
  private readonly emitter = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(
    private readonly getClient: () => LanguageClient | undefined,
    private readonly getFocusedProject: () => vscode.Uri | undefined,
    private readonly lspApi?: LspProjectApi,
  ) {}

  refresh(): void {
    this.emitter.fire();
  }

  getRootItem(focused: vscode.Uri): ProjectTreeItem {
    const root = new ProjectTreeItem(
      "root",
      vscode.workspace.asRelativePath(focused),
      vscode.TreeItemCollapsibleState.Expanded,
      focused,
    );
    root.iconPath = themeIcon("project");
    return root;
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    if (element.unresolved) {
      element.iconPath = themeIcon("warning");
    }
    return element;
  }

  async getChildren(element?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
    const focused = this.getFocusedProject();
    if (!element) {
      if (!focused) {
        return [
          new ProjectTreeItem(
            "info",
            "Focus a project (tree or editor).",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
      return [this.getRootItem(focused)];
    }

    if (!this.lspApi || !focused) {
      return [];
    }

    if (element.nodeType === "root") {
      const targets = new ProjectTreeItem("targets", "Targets", vscode.TreeItemCollapsibleState.Collapsed);
      targets.iconPath = themeIcon("symbol-method");
      const deps = new ProjectTreeItem(
        "dependencies",
        "Dependencies",
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      deps.iconPath = themeIcon("package");
      const sources = new ProjectTreeItem(
        "sources",
        "Source folders",
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      sources.iconPath = themeIcon("folder");
      return [targets, deps, sources];
    }

    if (element.nodeType === "dependencies") {
      const graph = await this.lspApi.getProjectGraph(focused.toString());
      const items: ProjectTreeItem[] = [];
      for (const node of graph?.nodes ?? []) {
        if (node.kind === "root") {
          continue;
        }
        if (node.kind === "path" || node.kind === "registry" || node.kind === "dependency") {
          const label = node.label;
          const item = new ProjectTreeItem(
            "dep",
            label,
            vscode.TreeItemCollapsibleState.None,
            node.uri ? vscode.Uri.parse(node.uri) : undefined,
            node.unresolved,
          );
          item.description = node.kind;
          item.iconPath = node.unresolved ? themeIcon("warning") : themeIcon("package");
          items.push(item);
        }
      }
      for (const u of graph?.unresolved ?? []) {
        const item = new ProjectTreeItem(
          "dep",
          u,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          true,
        );
        item.description = "unresolved";
        item.iconPath = themeIcon("warning");
        items.push(item);
      }
      if (items.length === 0) {
        const data = await this.lspApi.getProjectDependencies(focused.toString());
        for (const dep of data?.declared ?? []) {
          const label = dep.version ? `${dep.name}@${dep.version}` : dep.name;
          items.push(
            new ProjectTreeItem("dep", label, vscode.TreeItemCollapsibleState.None, undefined, false),
          );
        }
      }
      return items;
    }

    if (element.nodeType === "targets") {
      const graph = await this.lspApi.getProjectGraph(focused.toString());
      const rootNode = graph?.nodes.find((n) => n.kind === "root");
      const label = rootNode?.projectName
        ? `${rootNode.projectName} (${rootNode.kind ?? "project"})`
        : "Project";
      return [new ProjectTreeItem("target", label, vscode.TreeItemCollapsibleState.None)];
    }

    if (element.nodeType === "sources") {
      const graph = await this.lspApi.getProjectGraph(focused.toString());
      const roots = new Set<string>();
      for (const node of graph?.nodes ?? []) {
        if (node.sourceRoot?.trim()) {
          roots.add(node.sourceRoot);
        }
      }
      if (roots.size === 0) {
        const rootDir = dirname(focused.fsPath);
        const pattern = new vscode.RelativePattern(rootDir, "**/*.bd");
        const files = await vscode.workspace.findFiles(pattern, "**/target/**", 40);
        for (const file of files) {
          roots.add(dirname(file.fsPath));
        }
      }
      return [...roots].sort().map((dir) => {
        const item = new ProjectTreeItem(
          "folder",
          vscode.workspace.asRelativePath(vscode.Uri.file(dir)),
          vscode.TreeItemCollapsibleState.None,
          vscode.Uri.file(dir),
        );
        item.iconPath = themeIcon("folder");
        return item;
      });
    }

    return [];
  }
}
