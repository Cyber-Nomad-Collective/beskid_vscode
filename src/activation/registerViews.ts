import * as vscode from "vscode";
import type { BeskidDebugTreeProvider, DebugTreeItem } from "../debug/BeskidDebugTreeProvider.js";
import type { SelectedProjectOutlineProvider } from "../outline/SelectedProjectOutlineProvider.js";
import type { OutlineTreeItem } from "../outline/OutlineTreeItem.js";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { PackageTreeItem } from "../packages/PackageTreeItem.js";
import type { ProjectsTreeItem } from "../workspace/ProjectsTreeItem.js";
import type { ProjectsTreeProvider } from "../workspace/ProjectsTreeProvider.js";
import {
  BESKID_TREE_VIEW_IDS,
  type BeskidTreeViewId,
} from "../views/beskidViewIds.js";

function readDebugViewEnabled(): boolean {
  return vscode.workspace.getConfiguration("beskid").get<boolean>("debug.enabled", false) ?? false;
}

export type RegisteredViews = {
  projectsTreeView: vscode.TreeView<ProjectsTreeItem>;
  debugTreeView?: vscode.TreeView<DebugTreeItem>;
  packagesTreeView: vscode.TreeView<PackageTreeItem>;
  outlineTreeView: vscode.TreeView<OutlineTreeItem>;
};

export type RegisterViewsDeps = {
  projectsTree: ProjectsTreeProvider;
  packageProvider: PackageManagerProvider;
  outlineProvider: SelectedProjectOutlineProvider;
  debugProvider: BeskidDebugTreeProvider;
};

/** Sidebar tree views must use `createTreeView` so VS Code registers focus/reveal commands. */
export function registerViews(
  context: vscode.ExtensionContext,
  deps: RegisterViewsDeps,
): RegisteredViews {
  const views: Partial<Record<BeskidTreeViewId, vscode.TreeView<unknown>>> = {
    beskidProjectsView: vscode.window.createTreeView("beskidProjectsView", {
      treeDataProvider: deps.projectsTree,
      showCollapseAll: true,
    }),
    beskidPackagesView: vscode.window.createTreeView("beskidPackagesView", {
      treeDataProvider: deps.packageProvider,
    }),
    beskidProjectOutlineView: vscode.window.createTreeView("beskidProjectOutlineView", {
      treeDataProvider: deps.outlineProvider,
    }),
  };

  let debugTreeView: vscode.TreeView<DebugTreeItem> | undefined;
  if (readDebugViewEnabled()) {
    debugTreeView = vscode.window.createTreeView("beskidDebugView", {
      treeDataProvider: deps.debugProvider,
      showCollapseAll: true,
    });
    views.beskidDebugView = debugTreeView;
  }

  for (const id of BESKID_TREE_VIEW_IDS) {
    context.subscriptions.push(views[id]!);
  }
  if (debugTreeView) {
    context.subscriptions.push(debugTreeView);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("beskid.debug.enabled")) {
        void vscode.window
          .showInformationMessage(
            "Beskid Debug view setting changed. Reload the window to apply.",
            "Reload",
          )
          .then((choice) => {
            if (choice === "Reload") {
              void vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          });
      }
    }),
  );

  return {
    projectsTreeView: views.beskidProjectsView as vscode.TreeView<ProjectsTreeItem>,
    debugTreeView,
    packagesTreeView: views.beskidPackagesView as vscode.TreeView<PackageTreeItem>,
    outlineTreeView: views.beskidProjectOutlineView as vscode.TreeView<OutlineTreeItem>,
  };
}
