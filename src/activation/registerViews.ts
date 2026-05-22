import * as vscode from "vscode";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { SelectedProjectOutlineProvider } from "../outline/SelectedProjectOutlineProvider.js";
import type { ProjectTreeProvider } from "../workspace/ProjectTreeProvider.js";
import type { WorkspaceTreeProvider } from "../workspace/WorkspaceTreeProvider.js";
import type { WorkspaceTreeItem } from "../workspace/WorkspaceTreeProvider.js";
import type { ProjectTreeItem } from "../workspace/ProjectTreeProvider.js";

export type RegisteredViews = {
  workspaceTreeView: vscode.TreeView<WorkspaceTreeItem>;
  projectTreeView: vscode.TreeView<ProjectTreeItem>;
};

export function registerViews(
  context: vscode.ExtensionContext,
  deps: {
    workspaceTree: WorkspaceTreeProvider;
    projectTree: ProjectTreeProvider;
    packageProvider: PackageManagerProvider;
    outlineProvider: SelectedProjectOutlineProvider;
  },
): RegisteredViews {
  const workspaceTreeView = vscode.window.createTreeView("beskidWorkspaceView", {
    treeDataProvider: deps.workspaceTree,
    showCollapseAll: true,
  });
  const projectTreeView = vscode.window.createTreeView("beskidProjectView", {
    treeDataProvider: deps.projectTree,
    showCollapseAll: true,
  });
  context.subscriptions.push(
    workspaceTreeView,
    projectTreeView,
    vscode.window.registerTreeDataProvider("beskidPackagesView", deps.packageProvider),
    vscode.window.registerTreeDataProvider("beskidProjectOutlineView", deps.outlineProvider),
  );
  return { workspaceTreeView, projectTreeView };
}
