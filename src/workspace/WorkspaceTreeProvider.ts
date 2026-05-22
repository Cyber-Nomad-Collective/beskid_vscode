import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import type { LspProjectApi } from "./lspProjectApi.js";
import type { WorkspaceListEntry } from "./lspProjectTypes.js";
import { ContextValue, prefixMultiRootLabel, themeIcon } from "./tree/treeItemHelpers.js";

export class WorkspaceTreeItem extends vscode.TreeItem {
  constructor(
    readonly nodeType: "workspace" | "member" | "hint" | "info",
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    readonly workspaceUri?: string,
    readonly projectUri?: string,
  ) {
    super(label, collapsibleState);
  }
}

export class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeItem> {
  private readonly emitter = new vscode.EventEmitter<WorkspaceTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private workspaces: WorkspaceListEntry[] = [];

  constructor(
    private readonly getClient: () => LanguageClient | undefined,
    private readonly onFocusProject: (uri: vscode.Uri) => Promise<void>,
    private readonly lspApi?: LspProjectApi,
  ) {}

  refresh(): void {
    this.emitter.fire();
  }

  getRevealTarget(projectUri: vscode.Uri): WorkspaceTreeItem {
    const projectStr = projectUri.toString();
    for (const ws of this.workspaces) {
      const member = ws.members.find((m) => m.uri === projectStr);
      if (member && ws.uri) {
        return new WorkspaceTreeItem(
          "member",
          member.name,
          vscode.TreeItemCollapsibleState.None,
          ws.uri,
          projectStr,
        );
      }
    }
    return new WorkspaceTreeItem(
      "info",
      vscode.workspace.asRelativePath(projectUri),
      vscode.TreeItemCollapsibleState.None,
      undefined,
      projectStr,
    );
  }

  getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkspaceTreeItem): Promise<WorkspaceTreeItem[]> {
    if (!element) {
      const client = this.getClient();
      if (!client) {
        return [
          new WorkspaceTreeItem(
            "info",
            "Start Beskid LSP to load workspaces.",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
      if (this.lspApi) {
        this.workspaces = await this.lspApi.listWorkspaces();
      } else {
        this.workspaces = [];
      }
      if (this.workspaces.length === 0) {
        return [
          new WorkspaceTreeItem(
            "info",
            "No Workspace.proj found in open folders.",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }
      return this.workspaces.map((ws) => {
        const label = prefixMultiRootLabel(ws.name, ws.uri);
        const item = new WorkspaceTreeItem(
          "workspace",
          label,
          vscode.TreeItemCollapsibleState.Expanded,
          ws.uri,
        );
        item.iconPath = themeIcon("root-folder");
        item.contextValue = ContextValue.workspace;
        return item;
      });
    }

    if (element.nodeType === "workspace" && element.workspaceUri) {
      const ws = this.workspaces.find((w) => w.uri === element.workspaceUri);
      if (!ws) {
        return [];
      }
      const children: WorkspaceTreeItem[] = ws.members.map((member) => {
        const projectUri = member.uri?.trim() ? member.uri : undefined;
        const item = new WorkspaceTreeItem(
          "member",
          member.name,
          vscode.TreeItemCollapsibleState.None,
          ws.uri,
          projectUri,
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
      const wsRoot = vscode.Uri.parse(element.workspaceUri).fsPath;
      const pkgJson = join(dirname(wsRoot), "workspace.package.json");
      const hint = new WorkspaceTreeItem(
        "hint",
        "workspace.package.json",
        vscode.TreeItemCollapsibleState.None,
        element.workspaceUri,
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
      return children;
    }

    return [];
  }
}
