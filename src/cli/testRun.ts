import type { ChildProcess } from "node:child_process";

/** What a `beskid test --json` run reports to its terminal. Pure: no `vscode` import. */
export type TestRunHooks = {
	write(text: string): void;
	/** Called once with the complete stdout when the process exits normally. */
	report(stdout: string): void;
	/** Called at most once, with the exit code. */
	done(code: number): void;
};

export type TestRun = {
	/** Kills the process; no further hooks are called. */
	stop(): void;
};

/** Follows a started `beskid test --json` process until it exits or is stopped. */
export function followTestRun(child: ChildProcess, hooks: TestRunHooks): TestRun {
	let stdout = "";
	let finished = false;
	const finish = (code: number) => {
		if (finished) {
			return;
		}
		finished = true;
		hooks.done(code);
	};
	child.stdout?.on("data", (chunk: Buffer) => {
		stdout += chunk.toString();
	});
	child.stderr?.on("data", (chunk: Buffer) => {
		if (!finished) {
			hooks.write(chunk.toString());
		}
	});
	child.on("error", (error: Error) => {
		if (!finished) {
			hooks.write(`${error.message}\n`);
		}
		finish(1);
	});
	child.on("close", (code: number | null) => {
		if (finished) {
			return;
		}
		hooks.report(stdout);
		finish(code ?? 1);
	});
	return {
		stop: () => {
			finished = true;
			if (child.exitCode === null && child.signalCode === null) {
				child.kill();
			}
		},
	};
}
