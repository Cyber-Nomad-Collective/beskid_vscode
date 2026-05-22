import * as vscode from "vscode";
import type { FocusCoordinator } from "../runtime/FocusCoordinator.js";
import type { BeskidLspSession } from "../runtime/BeskidLspSession.js";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";
import type { RegisteredViews } from "../activation/registerViews.js";
import type { WorkspaceTreeProvider } from "../workspace/WorkspaceTreeProvider.js";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { ProjectTreeProvider } from "../workspace/ProjectTreeProvider.js";

export function registerExplorerCommands(
  context: vscode.ExtensionContext,
  deps: {
    focus: FocusCoordinator;
    session: BeskidLspSession;
    refresh: RefreshCoordinator;
    views: RegisteredViews;
    workspaceTree: WorkspaceTreeProvider;
    projectTree: ProjectTreeProvider;
    packageProvider: PackageManagerProvider;
  },
): void {
  const client = () => deps.session.getClient();

  context.subscriptions.push(
    vscode.commands.registerCommand("beskid.selectProject", async () => {
      const files = await vscode.workspace.findFiles("**/*.proj", "**/target/**", 300);
      if (files.length === 0) {
        void vscode.window.showWarningMessage("No .proj files found in workspace.");
        return;
      }
      const selected = await vscode.window.showQuickPick(
        files.map((uri) => ({ label: vscode.workspace.asRelativePath(uri), uri })),
        { placeHolder: "Select Beskid project manifest" },
      );
      if (selected) {
        await deps.focus.setFocusedProject(selected.uri, client(), deps.refresh);
      }
    }),
    vscode.commands.registerCommand("beskid.focusProject", (uri?: vscode.Uri) => {
      if (uri) {
        return deps.focus.setFocusedProject(uri, client(), deps.refresh);
      }
    }),
    vscode.commands.registerCommand("beskid.clearFocus", () => deps.focus.clearFocus(client(), deps.refresh)),
    vscode.commands.registerCommand("beskid.refreshWorkspace", async () => {
      deps.packageProvider.clearCaches();
      await deps.refresh.scheduleFull();
      deps.packageProvider.refresh();
    }),
    vscode.commands.registerCommand("beskid.revealInWorkspaceTree", async () => {
      await vscode.commands.executeCommand("beskidWorkspaceView.focus");
      const uri = deps.focus.getFocusedProject();
      if (uri) {
        await deps.views.workspaceTreeView.reveal(
          deps.workspaceTree.getRevealTarget(uri),
          { select: true, focus: false, expand: true },
        );
      } else {
        deps.workspaceTree.refresh();
      }
    }),
    vscode.commands.registerCommand("beskid.revealInProjectTree", async () => {
      await vscode.commands.executeCommand("beskidProjectView.focus");
      const uri = deps.focus.getFocusedProject();
      if (uri) {
        await deps.views.projectTreeView.reveal(deps.projectTree.getRootItem(uri), {
          select: true,
          focus: false,
          expand: true,
        });
      } else {
        deps.projectTree.refresh();
      }
    }),
  );
}
