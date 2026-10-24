import { spawn } from "node:child_process";
import * as vscode from "vscode";
import { clearTestDiagnostics, publishTestDiagnostics } from "./testDiagnostics.js";

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
				let stdout = "";
				const child = spawn(cli, fullArgs, {
					cwd,
					shell: process.platform === "win32",
				});
				child.stdout.on("data", (chunk: Buffer) => {
					stdout += chunk.toString();
				});
				child.stderr.on("data", (chunk: Buffer) =>
					writeEmitter.fire(crlf(chunk.toString())),
				);
				child.on("error", (error) => {
					writeEmitter.fire(crlf(`${error.message}\n`));
					closeEmitter.fire(1);
				});
				child.on("close", async (code) => {
					const shown = await publishTestDiagnostics(stdout, cwd);
					if (shown.length === 0) {
						writeEmitter.fire(crlf(stdout));
					}
					for (const item of shown) {
						writeEmitter.fire(
							crlf(`FAIL ${item.file}:${item.line}:${item.column}\n  ${item.message.replace(/\n/g, "\n  ")}\n`),
						);
					}
					closeEmitter.fire(code ?? 1);
				});
			},
			close: () => {},
		};
	});
}
