import * as vscode from "vscode";
import type { FocusCoordinator } from "../runtime/FocusCoordinator.js";
import type { BeskidLspSession } from "../runtime/BeskidLspSession.js";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";
import type { RegisteredViews } from "../activation/registerViews.js";
import type { ProjectsTreeProvider } from "../workspace/ProjectsTreeProvider.js";

async function revealInProjectsTree(
  views: RegisteredViews,
  projectsTree: ProjectsTreeProvider,
  projectUri: vscode.Uri | undefined,
): Promise<void> {
  await vscode.commands.executeCommand("beskidProjectsView.focus");
  if (projectUri) {
    await views.projectsTreeView.reveal(projectsTree.getRevealTarget(projectUri), {
      select: true,
      focus: false,
      expand: true,
    });
  } else {
    projectsTree.refresh();
  }
}

export function registerExplorerCommands(
  context: vscode.ExtensionContext,
  deps: {
    focus: FocusCoordinator;
    session: BeskidLspSession;
    refresh: RefreshCoordinator;
    views: RegisteredViews;
    projectsTree: ProjectsTreeProvider;
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
    vscode.commands.registerCommand("beskid.revealInProjectsTree", async () => {
      await revealInProjectsTree(deps.views, deps.projectsTree, deps.focus.getFocusedProject());
    }),
    vscode.commands.registerCommand("beskid.revealInWorkspaceTree", async () => {
      await revealInProjectsTree(deps.views, deps.projectsTree, deps.focus.getFocusedProject());
    }),
    vscode.commands.registerCommand("beskid.revealInProjectTree", async () => {
      await revealInProjectsTree(deps.views, deps.projectsTree, deps.focus.getFocusedProject());
    }),
  );
}
