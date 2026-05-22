import * as vscode from "vscode";
import { readCliPath } from "../config/workspaceSettings.js";

const TASK_TYPES = ["beskid-fetch", "beskid-lock", "beskid-build", "beskid-test", "beskid-analyze"] as const;

const SUBCOMMANDS: Record<(typeof TASK_TYPES)[number], string> = {
  "beskid-fetch": "fetch",
  "beskid-lock": "lock",
  "beskid-build": "build",
  "beskid-test": "test",
  "beskid-analyze": "analyze",
};

export function registerBeskidTaskProvider(context: vscode.ExtensionContext): void {
  const provider: vscode.TaskProvider = {
    provideTasks: () =>
      TASK_TYPES.map((type) => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        const definition: vscode.TaskDefinition = { type, projectPath: "${workspaceFolder}" };
        return new vscode.Task(
          definition,
          folder ?? vscode.TaskScope.Workspace,
          `Beskid ${SUBCOMMANDS[type]}`,
          "beskid",
          new vscode.ShellExecution(readCliPath(), [SUBCOMMANDS[type]], { cwd: "${workspaceFolder}" }),
        );
      }),
    resolveTask(task: vscode.Task): vscode.Task | undefined {
      const type = task.definition.type as (typeof TASK_TYPES)[number] | undefined;
      if (!type || !(type in SUBCOMMANDS)) {
        return undefined;
      }
      const folder = vscode.workspace.workspaceFolders?.[0];
      const cwd = (task.definition.projectPath as string) ?? "${workspaceFolder}";
      return new vscode.Task(
        task.definition,
        task.scope ?? folder ?? vscode.TaskScope.Workspace,
        task.name,
        "beskid",
        new vscode.ShellExecution(readCliPath(), [SUBCOMMANDS[type]], { cwd }),
      );
    },
  };

  for (const type of TASK_TYPES) {
    context.subscriptions.push(vscode.tasks.registerTaskProvider(type, provider));
  }
}
