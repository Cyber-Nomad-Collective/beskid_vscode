import * as vscode from "vscode";

export type PackageTreeSection = "ThisProject" | "RegistrySearch";

export type PackageTreeNodeType =
  | "section"
  | "info"
  | "declared"
  | "locked"
  | "unresolved"
  | "searchAction"
  | "package"
  | "version"
  | "dependency"
  | "readme";

export class PackageTreeItem extends vscode.TreeItem {
  constructor(
    readonly nodeType: PackageTreeNodeType,
    readonly section: PackageTreeSection | undefined,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    readonly packageName?: string,
    readonly version?: string,
    readonly payload?: Record<string, unknown>,
  ) {
    super(label, collapsibleState);
  }
}
