import * as vscode from "vscode";
import type { FocusCoordinator } from "../runtime/FocusCoordinator.js";
import type { BeskidLspSession } from "../runtime/BeskidLspSession.js";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";
import type { RegisteredViews } from "../activation/registerViews.js";
import type { ProjectsTreeProvider } from "../workspace/ProjectsTreeProvider.js";
import { resolveFocusTarget, type FocusTargetInput } from "../workspace/resolveFocusTarget.js";

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

type ExplorerCommandDeps = {
  focus: FocusCoordinator;
  session: BeskidLspSession;
  refresh: RefreshCoordinator;
};

export function registerCoreExplorerCommands(
  context: vscode.ExtensionContext,
  deps: ExplorerCommandDeps,
): void {
  const client = () => deps.session.getClient();

  context.subscriptions.push(
    vscode.commands.registerCommand("beskid.selectProject", async () => {
      const files = await vscode.workspace.findFiles("**/*.bproj", "**/target/**", 300);
      if (files.length === 0) {
        void vscode.window.showWarningMessage("No .bproj files found in workspace.");
        return;
      }
      const selected = await vscode.window.showQuickPick(
        files.map((uri) => ({ label: vscode.workspace.asRelativePath(uri), uri })),
        { placeHolder: "Select Beskid project manifest" },
      );
      if (selected) {
        const uri = resolveFocusTarget(selected.uri);
        if (uri) {
          await deps.focus.setFocusedProject(uri, client(), deps.refresh);
        }
      }
    }),
    vscode.commands.registerCommand("beskid.focusProject", async (target?: FocusTargetInput) => {
      const uri = resolveFocusTarget(target);
      if (uri) {
        await deps.focus.setFocusedProject(uri, client(), deps.refresh);
      }
    }),
    vscode.commands.registerCommand("beskid.clearFocus", async () => {
      await deps.focus.clearFocus(client(), deps.refresh);
    }),
  );
}

export function registerDeferredExplorerCommands(
  context: vscode.ExtensionContext,
  deps: ExplorerCommandDeps & {
    views: RegisteredViews;
    projectsTree: ProjectsTreeProvider;
  },
): void {
  context.subscriptions.push(
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
