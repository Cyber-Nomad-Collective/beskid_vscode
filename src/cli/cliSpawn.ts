import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

export type CliSpawnOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
};

/**
 * Starts the Beskid CLI with an argv array and no shell, so paths with spaces
 * or shell metacharacters (`a&calc`) reach the CLI verbatim on every platform.
 */
export function spawnCli(
	command: string,
	args: readonly string[],
	options: CliSpawnOptions = {},
): ChildProcessWithoutNullStreams {
	return spawn(command, [...args], {
		cwd: options.cwd,
		env: options.env ?? process.env,
		shell: false,
	});
}
