import * as vscode from "vscode";
import { readCliPath } from "../config/workspaceSettings.js";
import { negotiateCliCapabilities } from "./cliCapabilities.js";
import {
	type BeskidCliOperation,
	cliOperationLabel,
	cliTaskInvocation,
} from "./cliCommandSurface.js";

export const BESKID_TASK_TYPES: Record<string, BeskidCliOperation> = {
	"beskid-fetch": "fetch",
	"beskid-lock": "lock",
	"beskid-build": "build",
	"beskid-test": "test",
	"beskid-check": "check",
};

const WORKSPACE_FOLDER = "${workspaceFolder}";

function createTask(
	cli: string,
	definition: vscode.TaskDefinition,
	operation: BeskidCliOperation,
	scope: vscode.WorkspaceFolder | vscode.TaskScope,
	name: string,
): vscode.Task {
	const invocation = cliTaskInvocation(
		operation,
		definition.projectPath as string | undefined,
		WORKSPACE_FOLDER,
	);
	return new vscode.Task(
		definition,
		scope,
		name,
		"beskid",
		new vscode.ShellExecution(cli, invocation.args, { cwd: invocation.cwd }),
	);
}

/** Resolves the CLI only when it negotiates the 0.6 surface; otherwise reports upgrade guidance. */
async function compatibleCli(): Promise<string | undefined> {
	const cli = readCliPath();
	const compatibility = await negotiateCliCapabilities(cli);
	if (compatibility.compatible) {
		return cli;
	}
	void vscode.window.showErrorMessage(compatibility.guidance);
	return undefined;
}

export function registerBeskidTaskProvider(
	context: vscode.ExtensionContext,
): void {
	const provider: vscode.TaskProvider = {
		provideTasks: async () => {
			const cli = await compatibleCli();
			if (!cli) {
				return [];
			}
			const folder = vscode.workspace.workspaceFolders?.[0];
			return Object.entries(BESKID_TASK_TYPES).map(([type, operation]) =>
				createTask(
					cli,
					{ type, projectPath: WORKSPACE_FOLDER },
					operation,
					folder ?? vscode.TaskScope.Workspace,
					`Beskid ${cliOperationLabel(operation)}`,
				),
			);
		},
		resolveTask: async (task: vscode.Task) => {
			const type = task.definition.type as string | undefined;
			const operation = type ? BESKID_TASK_TYPES[type] : undefined;
			if (!operation) {
				return undefined;
			}
			const cli = await compatibleCli();
			if (!cli) {
				return undefined;
			}
			const folder = vscode.workspace.workspaceFolders?.[0];
			return createTask(
				cli,
				task.definition,
				operation,
				task.scope ?? folder ?? vscode.TaskScope.Workspace,
				task.name,
			);
		},
	};

	for (const type of Object.keys(BESKID_TASK_TYPES)) {
		context.subscriptions.push(vscode.tasks.registerTaskProvider(type, provider));
	}
}
