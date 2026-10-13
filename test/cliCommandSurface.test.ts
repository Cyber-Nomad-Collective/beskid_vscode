import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";
import {
	CLI_LSP_ARGS,
	cliOperationArgs,
	cliTaskInvocation,
	isCliLspLaunch,
} from "../src/cli/cliCommandSurface.js";
import { launchSnapshotFromExecutable } from "../src/lsp/launchSnapshot.js";

describe("CLI command surface", () => {
	test("language server launches as `dev lsp`", () => {
		expect([...CLI_LSP_ARGS]).toEqual(["dev", "lsp"]);
		expect(isCliLspLaunch(["dev", "lsp"])).toBe(true);
		expect(isCliLspLaunch(["lsp"])).toBe(false);
	});

	test("launch snapshot classifies `dev lsp` as the CLI source", () => {
		const cli = launchSnapshotFromExecutable({
			command: "/opt/beskid",
			args: [...CLI_LSP_ARGS],
		});
		expect(cli.source).toBe("cli");
		expect(cli.binaryPath).toBe("/opt/beskid");
		expect(
			launchSnapshotFromExecutable({ command: "/opt/beskid", args: ["lsp"] })
				.source,
		).not.toBe("cli");
	});

	test("check runs `beskid check` with explicit project context", () => {
		expect(cliOperationArgs("check")).toEqual(["check"]);
		expect(cliOperationArgs("check", "/w/app/app.bproj")).toEqual([
			"check",
			"--project",
			"/w/app/app.bproj",
		]);
	});

	test("fetch and lock use `dev project`", () => {
		expect(cliOperationArgs("fetch", "/w/app/app.bproj")).toEqual([
			"dev",
			"project",
			"fetch",
			"--project",
			"/w/app/app.bproj",
		]);
		expect(cliOperationArgs("lock")).toEqual(["dev", "project", "lock"]);
	});

	test("workspace manifests are resolved from cwd, not passed as --project", () => {
		expect(cliOperationArgs("build", "/w/ws.bws")).toEqual(["build"]);
	});

	test("task projectPath accepts a directory or a .bproj manifest", () => {
		expect(cliTaskInvocation("check", "/w/app/app.bproj", "${workspaceFolder}")).toEqual({
			cwd: "/w/app",
			args: ["check", "--project", "/w/app/app.bproj"],
		});
		expect(cliTaskInvocation("test", "/w/app", "${workspaceFolder}")).toEqual({
			cwd: "/w/app",
			args: ["test"],
		});
		expect(cliTaskInvocation("build", undefined, "${workspaceFolder}")).toEqual({
			cwd: "${workspaceFolder}",
			args: ["build"],
		});
	});
});

describe("package.json CLI contributions", () => {
	test("contributes beskid.cli.check and no analyze command", () => {
		const ids = pkg.contributes.commands.map((c: { command: string }) => c.command);
		expect(ids).toContain("beskid.cli.check");
		expect(ids).not.toContain("beskid.cli.analyze");
	});

	test("contributes beskid-check task type and no analyze task", () => {
		const types = pkg.contributes.taskDefinitions.map(
			(d: { type: string }) => d.type,
		);
		expect(types).toContain("beskid-check");
		expect(types).not.toContain("beskid-analyze");
	});
});

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		return statSync(path).isDirectory()
			? sourceFiles(path)
			: path.endsWith(".ts")
				? [path]
				: [];
	});
}

describe("no retired CLI spellings in extension sources", () => {
	const retired = [
		/"analyze"/,
		/\["lsp"(\]|, "--help")/,
		/\["fetch"/,
		/\["lock"/,
		/"--help"/,
		/beskid pckg /,
		/beskid new install/,
		/`beskid (analyze|lsp|fetch|lock|format|up|graph|parse|tree|clif)\b/,
	];
	test("src/ never spells a retired 0.5 command", () => {
		const offenders: string[] = [];
		for (const file of sourceFiles(join(import.meta.dir, "..", "src"))) {
			const text = readFileSync(file, "utf8");
			for (const pattern of retired) {
				if (pattern.test(text)) {
					offenders.push(`${file}: ${pattern}`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
