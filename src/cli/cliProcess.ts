import { spawn } from "node:child_process";

export type CliProcessResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

export type CliProcessOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
};

export async function runCliProcess(
	command: string,
	args: string[],
	options: CliProcessOptions = {},
): Promise<CliProcessResult> {
	return new Promise((resolve, reject) => {
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			shell: process.platform === "win32",
		});

		child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
		child.on("error", reject);
		child.on("close", (code) => {
			resolve({
				exitCode: code ?? 1,
				stdout: Buffer.concat(stdoutChunks).toString("utf8"),
				stderr: Buffer.concat(stderrChunks).toString("utf8"),
			});
		});
	});
}

export function appendCliProcessLog(
	outputChannel: { appendLine: (line: string) => void },
	command: string,
	args: string[],
	cwd: string | undefined,
	result: CliProcessResult,
): void {
	const cwdSuffix = cwd ? ` (cwd: ${cwd})` : "";
	outputChannel.appendLine(`$ ${command} ${args.join(" ")}${cwdSuffix}`);
	if (result.stdout.trim().length > 0) {
		outputChannel.appendLine(result.stdout.trimEnd());
	}
	if (result.stderr.trim().length > 0) {
		outputChannel.appendLine(result.stderr.trimEnd());
	}
	outputChannel.appendLine(`exit ${result.exitCode}`);
}
