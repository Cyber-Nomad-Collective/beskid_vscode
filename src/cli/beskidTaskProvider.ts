import * as vscode from "vscode";
import {
	BESKID_TASK_TYPES,
	taskBelongsToProvider,
	taskSpecsForType,
} from "./beskidTaskTypes.js";
import { negotiateCliCapabilities } from "./cliCapabilities.js";
import { type BeskidCliOperation, cliTaskInvocation } from "./cliCommandSurface.js";
import { testExecution } from "./testTask.js";
import { resolveCli } from "./toolchain.js";

export { BESKID_TASK_TYPES };

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
	if (operation === "test") {
		return new vscode.Task(
			definition,
			scope,
			name,
			"beskid",
			testExecution(cli, invocation.args, invocation.cwd),
		);
	}
	return new vscode.Task(
		definition,
		scope,
		name,
		"beskid",
		new vscode.ShellExecution(cli, invocation.args, { cwd: invocation.cwd }),
	);
}

/** Resolves the CLI only when it negotiates the 0.6 surface; otherwise reports upgrade guidance. */
async function compatibleCli(notify: boolean): Promise<string | undefined> {
	const selected = await resolveCli();
	if (selected.source === "none") {
		if (notify) {
			void vscode.window.showErrorMessage(selected.reason);
		}
		return undefined;
	}
	const cli = selected.cliPath;
	const compatibility = await negotiateCliCapabilities(cli);
	if (compatibility.compatible) {
		return cli;
	}
	if (notify) {
		void vscode.window.showErrorMessage(compatibility.guidance);
	}
	return undefined;
}

function providerFor(type: string): vscode.TaskProvider {
	return {
		provideTasks: async () => {
			const specs = taskSpecsForType(type, WORKSPACE_FOLDER);
			if (specs.length === 0) {
				return [];
			}
			const cli = await compatibleCli(false);
			if (!cli) {
				return [];
			}
			const folder = vscode.workspace.workspaceFolders?.[0];
			return specs.map((spec) =>
				createTask(
					cli,
					spec.definition,
					spec.operation,
					folder ?? vscode.TaskScope.Workspace,
					spec.name,
				),
			);
		},
		resolveTask: async (task: vscode.Task) => {
			const taskType = task.definition.type as string | undefined;
			if (!taskBelongsToProvider(type, taskType)) {
				return undefined;
			}
			const cli = await compatibleCli(true);
			if (!cli) {
				return undefined;
			}
			const folder = vscode.workspace.workspaceFolders?.[0];
			return createTask(
				cli,
				task.definition,
				BESKID_TASK_TYPES[type],
				task.scope ?? folder ?? vscode.TaskScope.Workspace,
				task.name,
			);
		},
	};
}

/** One provider per task type; each returns only tasks of its own type. */
export function registerBeskidTaskProvider(
	context: vscode.ExtensionContext,
): void {
	for (const type of Object.keys(BESKID_TASK_TYPES)) {
		context.subscriptions.push(
			vscode.tasks.registerTaskProvider(type, providerFor(type)),
		);
	}
}
