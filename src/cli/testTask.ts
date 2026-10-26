import * as vscode from "vscode";
import { spawnCli } from "./cliSpawn.js";
import { clearTestDiagnostics, publishTestDiagnostics } from "./testDiagnostics.js";
import { followTestRun, type TestRun } from "./testRun.js";

const WORKSPACE_FOLDER = "${workspaceFolder}";

/**
 * The `beskid-test` task: runs `beskid test --json` in a pseudoterminal, prints the
 * failures as text and shows them as diagnostics until the next run.
 */
export function testExecution(
	cli: string,
	args: string[],
	cwdTemplate: string,
): vscode.CustomExecution {
	return new vscode.CustomExecution(async () => {
		const writeEmitter = new vscode.EventEmitter<string>();
		const closeEmitter = new vscode.EventEmitter<number>();
		const crlf = (text: string) => text.replace(/\r?\n/g, "\r\n");
		let run: TestRun | undefined;
		return {
			onDidWrite: writeEmitter.event,
			onDidClose: closeEmitter.event,
			open: () => {
				const cwd =
					cwdTemplate === WORKSPACE_FOLDER
						? (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd())
						: cwdTemplate;
				clearTestDiagnostics();
				const fullArgs = [...args, "--json"];
				writeEmitter.fire(crlf(`> ${cli} ${fullArgs.join(" ")}\n`));
				run = followTestRun(spawnCli(cli, fullArgs, { cwd }), {
					write: (text) => writeEmitter.fire(crlf(text)),
					report: (stdout) => {
						const shown = publishTestDiagnostics(stdout, cwd);
						if (shown.length === 0) {
							writeEmitter.fire(crlf(stdout));
						}
						for (const item of shown) {
							writeEmitter.fire(
								crlf(`FAIL ${item.file}:${item.line}:${item.column}\n  ${item.message.replace(/\n/g, "\n  ")}\n`),
							);
						}
					},
					done: (code) => closeEmitter.fire(code),
				});
			},
			close: () => {
				run?.stop();
				run = undefined;
			},
		};
	});
}
