import * as vscode from "vscode";
import type { BeskidDebugTreeProvider, DebugTreeItem } from "../debug/BeskidDebugTreeProvider.js";
import type { SelectedProjectOutlineProvider } from "../outline/SelectedProjectOutlineProvider.js";
import type { OutlineTreeItem } from "../outline/OutlineTreeItem.js";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { PackageTreeItem } from "../packages/PackageTreeItem.js";
import type { ProjectTreeItem } from "../workspace/ProjectTreeProvider.js";
import type { ProjectTreeProvider } from "../workspace/ProjectTreeProvider.js";
import type { WorkspaceTreeItem } from "../workspace/WorkspaceTreeProvider.js";
import type { WorkspaceTreeProvider } from "../workspace/WorkspaceTreeProvider.js";
import {
  BESKID_TREE_VIEW_IDS,
  type BeskidTreeViewId,
} from "../views/beskidViewIds.js";

export type RegisteredViews = {
  workspaceTreeView: vscode.TreeView<WorkspaceTreeItem>;
  projectTreeView: vscode.TreeView<ProjectTreeItem>;
  debugTreeView: vscode.TreeView<DebugTreeItem>;
  packagesTreeView: vscode.TreeView<PackageTreeItem>;
  outlineTreeView: vscode.TreeView<OutlineTreeItem>;
};

export type RegisterViewsDeps = {
  workspaceTree: WorkspaceTreeProvider;
  projectTree: ProjectTreeProvider;
  packageProvider: PackageManagerProvider;
  outlineProvider: SelectedProjectOutlineProvider;
  debugProvider: BeskidDebugTreeProvider;
};

/** Sidebar tree views must use `createTreeView` so VS Code registers focus/reveal commands. */
export function registerViews(
  context: vscode.ExtensionContext,
  deps: RegisterViewsDeps,
): RegisteredViews {
  const views = {
    beskidWorkspaceView: vscode.window.createTreeView("beskidWorkspaceView", {
      treeDataProvider: deps.workspaceTree,
      showCollapseAll: true,
    }),
    beskidProjectView: vscode.window.createTreeView("beskidProjectView", {
      treeDataProvider: deps.projectTree,
      showCollapseAll: true,
    }),
    beskidDebugView: vscode.window.createTreeView("beskidDebugView", {
      treeDataProvider: deps.debugProvider,
      showCollapseAll: true,
    }),
    beskidPackagesView: vscode.window.createTreeView("beskidPackagesView", {
      treeDataProvider: deps.packageProvider,
    }),
    beskidProjectOutlineView: vscode.window.createTreeView("beskidProjectOutlineView", {
      treeDataProvider: deps.outlineProvider,
    }),
  } satisfies Record<BeskidTreeViewId, vscode.TreeView<unknown>>;

  for (const id of BESKID_TREE_VIEW_IDS) {
    context.subscriptions.push(views[id]);
  }

  return {
    workspaceTreeView: views.beskidWorkspaceView,
    projectTreeView: views.beskidProjectView,
    debugTreeView: views.beskidDebugView,
    packagesTreeView: views.beskidPackagesView,
    outlineTreeView: views.beskidProjectOutlineView,
  };
}
