import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import type { LspProjectApi } from "./lspProjectApi.js";
import type { WorkspaceListEntry } from "./lspProjectTypes.js";
import { projectSectionChildren, projectSectionItems } from "./projectGraphTree.js";
import { ProjectsTreeItem } from "./ProjectsTreeItem.js";
import { ContextValue, prefixMultiRootLabel, themeIcon } from "./tree/treeItemHelpers.js";

/** Workspaces as containers; member projects expand into targets, deps, and sources. */
export class ProjectsTreeProvider implements vscode.TreeDataProvider<ProjectsTreeItem> {
  private readonly emitter = new vscode.EventEmitter<ProjectsTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private workspaces: WorkspaceListEntry[] = [];
  private standaloneProjectUris: string[] = [];

  constructor(
    private readonly getClient: () => LanguageClient | undefined,
    private readonly getFocusedProject: () => vscode.Uri | undefined,
    private readonly lspApi?: LspProjectApi,
  ) {}

  refresh(): void {
    this.emitter.fire();
  }

  getRevealTarget(projectUri: vscode.Uri): ProjectsTreeItem {
    const projectStr = projectUri.toString();
    for (const ws of this.workspaces) {
      const member = ws.members.find((m) => m.uri === projectStr);
      if (member && ws.uri) {
        return new ProjectsTreeItem(
          "member",
          member.name,
          vscode.TreeItemCollapsibleState.Expanded,
          projectStr,
          undefined,
          undefined,
          ws.uri,
        );
      }
    }
    return new ProjectsTreeItem(
      "standalone",
      vscode.workspace.asRelativePath(projectUri),
      vscode.TreeItemCollapsibleState.Expanded,
      projectStr,
    );
  }

  getTreeItem(element: ProjectsTreeItem): vscode.TreeItem {
    if (element.unresolved) {
      element.iconPath = themeIcon("warning");
    }
    return element;
  }

  async getChildren(element?: ProjectsTreeItem): Promise<ProjectsTreeItem[]> {
    if (!element) {
      return this.getRootChildren();
    }

    switch (element.nodeType) {
      case "workspace":
        return this.getWorkspaceChildren(element);
      case "standalone":
      case "member":
        if (element.projectUri && this.lspApi) {
          return projectSectionItems(this.lspApi, element.projectUri);
        }
        return [];
      case "section":
        if (element.projectUri && element.section && this.lspApi) {
          return projectSectionChildren(this.lspApi, element.projectUri, element.section);
        }
        return [];
      default:
        return [];
    }
  }

  private async getRootChildren(): Promise<ProjectsTreeItem[]> {
    const client = this.getClient();
    if (!client) {
      return [
        new ProjectsTreeItem("info", "Start Beskid LSP to load projects.", vscode.TreeItemCollapsibleState.None),
      ];
    }
    if (!this.lspApi) {
      return [];
    }

    this.workspaces = await this.lspApi.listWorkspaces();
    this.standaloneProjectUris = await this.discoverStandaloneProjectUris(this.workspaces);

    const items: ProjectsTreeItem[] = [];

    for (const ws of this.workspaces) {
      const label = prefixMultiRootLabel(ws.name, ws.uri);
      const item = new ProjectsTreeItem(
        "workspace",
        label,
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        undefined,
        undefined,
        ws.uri,
      );
      item.iconPath = themeIcon("root-folder");
      item.contextValue = ContextValue.workspace;
      items.push(item);
    }

    for (const uri of this.standaloneProjectUris) {
      const parsed = vscode.Uri.parse(uri);
      const item = new ProjectsTreeItem(
        "standalone",
        vscode.workspace.asRelativePath(parsed),
        vscode.TreeItemCollapsibleState.Collapsed,
        uri,
      );
      item.iconPath = themeIcon("project");
      item.description = "Project";
      item.contextValue = ContextValue.standaloneProject;
      item.command = {
        command: "beskid.focusProject",
        title: "Focus project",
        arguments: [parsed],
      };
      if (this.getFocusedProject()?.toString() === uri) {
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      items.push(item);
    }

    if (items.length === 0) {
      return [
        new ProjectsTreeItem(
          "info",
          "No Workspace.proj or Project.proj found in open folders.",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    return items;
  }

  private getWorkspaceChildren(element: ProjectsTreeItem): Promise<ProjectsTreeItem[]> {
    const ws = this.workspaces.find((w) => w.uri === element.workspaceUri);
    if (!ws) {
      return Promise.resolve([]);
    }

    const focusedUri = this.getFocusedProject()?.toString();
    const children: ProjectsTreeItem[] = ws.members.map((member) => {
      const projectUri = member.uri?.trim() ? member.uri : undefined;
      const expanded = projectUri !== undefined && projectUri === focusedUri;
      const item = new ProjectsTreeItem(
        "member",
        member.name,
        expanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
        projectUri,
        undefined,
        undefined,
        ws.uri,
      );
      item.description = member.memberId ?? member.name;
      item.iconPath = themeIcon("folder-library");
      item.contextValue = ContextValue.workspaceMember;
      if (projectUri) {
        item.command = {
          command: "beskid.focusProject",
          title: "Focus project",
          arguments: [vscode.Uri.parse(projectUri)],
        };
      }
      return item;
    });

    const wsRoot = vscode.Uri.parse(ws.uri).fsPath;
    const pkgJson = join(dirname(wsRoot), "workspace.package.json");
    const hint = new ProjectsTreeItem(
      "hint",
      "workspace.package.json",
      vscode.TreeItemCollapsibleState.None,
      undefined,
      undefined,
      undefined,
      ws.uri,
    );
    hint.iconPath = themeIcon("json");
    if (existsSync(pkgJson)) {
      hint.resourceUri = vscode.Uri.file(pkgJson);
      hint.command = {
        command: "vscode.open",
        title: "Open workspace.package.json",
        arguments: [hint.resourceUri],
      };
      hint.description = "Open workspace metadata";
    } else {
      hint.description = "Not present in workspace root";
    }
    children.push(hint);

    return Promise.resolve(children);
  }

  private async discoverStandaloneProjectUris(workspaces: WorkspaceListEntry[]): Promise<string[]> {
    const inWorkspace = new Set<string>();
    for (const ws of workspaces) {
      for (const member of ws.members) {
        if (member.uri?.trim()) {
          inWorkspace.add(member.uri);
        }
      }
    }
    const files = await vscode.workspace.findFiles("**/*.proj", "**/target/**", 300);
    return files
      .filter((uri) => {
        const base = uri.path.split("/").pop() ?? "";
        if (base === "Workspace.proj") {
          return false;
        }
        return !inWorkspace.has(uri.toString());
      })
      .map((uri) => uri.toString());
  }
}
