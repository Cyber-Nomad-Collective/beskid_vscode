import { describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { runCliProcess } from "../src/cli/cliProcess.js";
import { spawnCli } from "../src/cli/cliSpawn.js";
import { followTestRun } from "../src/cli/testRun.js";

const echoArgv = "process.stdout.write(JSON.stringify(process.argv.slice(1)))";

describe("spawnCli", () => {
	test("passes arguments verbatim without a shell", async () => {
		const args = ["dir with space", "a&calc", "$(whoami)", "x;y|z"];
		const result = await runCliProcess(process.execPath, ["-e", echoArgv, ...args]);
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout).slice(-args.length)).toEqual(args);
	});

	test("never asks for a shell", () => {
		const child = spawnCli(process.execPath, ["-e", ""]);
		expect(child.spawnargs[0]).toBe(process.execPath);
		child.kill();
	});
});

function fakeChild() {
	const child = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter;
		stderr: EventEmitter;
		exitCode: number | null;
		signalCode: string | null;
		kill: ReturnType<typeof mock>;
	};
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.exitCode = null;
	child.signalCode = null;
	child.kill = mock(() => true);
	return child;
}

describe("followTestRun", () => {
	test("reports stdout and closes once on exit", () => {
		const child = fakeChild();
		const done = mock((_code: number) => undefined);
		const report = mock((_stdout: string) => undefined);
		followTestRun(child as unknown as ChildProcess, { write: () => undefined, report, done });
		child.stdout.emit("data", Buffer.from("{\"a\":1}"));
		child.emit("close", 3);
		expect(report).toHaveBeenCalledWith("{\"a\":1}");
		expect(done.mock.calls).toEqual([[3]]);
	});

	test("an error followed by close fires done only once", () => {
		const child = fakeChild();
		const done = mock((_code: number) => undefined);
		const report = mock((_stdout: string) => undefined);
		followTestRun(child as unknown as ChildProcess, { write: () => undefined, report, done });
		child.emit("error", new Error("spawn ENOENT"));
		child.emit("close", -2);
		expect(done.mock.calls).toEqual([[1]]);
		expect(report).not.toHaveBeenCalled();
	});

	test("stop kills the running child and suppresses later hooks", () => {
		const child = fakeChild();
		const done = mock((_code: number) => undefined);
		const run = followTestRun(child as unknown as ChildProcess, {
			write: () => undefined,
			report: () => undefined,
			done,
		});
		run.stop();
		expect(child.kill).toHaveBeenCalledTimes(1);
		child.emit("close", null);
		expect(done).not.toHaveBeenCalled();
	});
});
