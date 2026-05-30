import * as vscode from "vscode";

export class ProjectsTreeItem extends vscode.TreeItem {
  constructor(
    readonly nodeType:
      | "info"
      | "workspace"
      | "standalone"
      | "member"
      | "hint"
      | "section"
      | "target"
      | "dep"
      | "folder",
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    readonly projectUri?: string,
    readonly section?: "targets" | "dependencies" | "sources",
    readonly unresolved?: boolean,
    readonly workspaceUri?: string,
  ) {
    super(label, collapsibleState);
  }
}
