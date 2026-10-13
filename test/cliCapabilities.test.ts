import { describe, expect, test } from "bun:test";
import {
	type CliProcessRunner,
	negotiateCliCapabilities,
	parseCliCapabilities,
} from "../src/cli/cliCapabilities.js";
import { CLI_CAPABILITIES_ARGS } from "../src/cli/cliCommandSurface.js";
import type { CliProcessResult } from "../src/cli/cliProcess.js";

const RETIRED_ROOT_SPELLINGS = [
	"analyze",
	"format",
	"pckg",
	"up",
	"parse",
	"tree",
	"clif",
	"fetch",
	"lock",
	"graph",
	"mod",
	"import",
	"lsp",
	"runtime-kit",
	"corelib",
	"repl",
	"validate-bsol",
	"migrate-bsol",
];

const FULL_DOCUMENT = {
	schemaVersion: 1,
	cliVersion: "0.6.0",
	commands: [
		"new",
		"check",
		"build",
		"run",
		"test",
		"fmt",
		"doc",
		"add",
		"remove",
		"update",
		"package",
		"toolchain",
		"doctor",
		"dev",
	],
	devCommands: [
		"syntax",
		"build",
		"project",
		"corelib",
		"runtime-kit",
		"mod",
		"import",
		"lsp",
		"bsol",
		"repl",
		"toolchain-owner",
		"capabilities",
	],
	outputSchemas: [
		{ command: "check", schemaVersion: 1, format: "ndjson", events: [] },
	],
};

function recordingRunner(
	result: CliProcessResult | Error,
): { run: CliProcessRunner; calls: string[][] } {
	const calls: string[][] = [];
	const run: CliProcessRunner = async (_command, args) => {
		calls.push(args);
		if (result instanceof Error) {
			throw result;
		}
		return result;
	};
	return { run, calls };
}

function expectOnlyCapabilityProbe(calls: string[][]): void {
	expect(calls).toEqual([[...CLI_CAPABILITIES_ARGS]]);
	for (const args of calls) {
		expect(RETIRED_ROOT_SPELLINGS).not.toContain(args[0]);
		expect(args).not.toContain("--help");
	}
}

describe("negotiateCliCapabilities", () => {
	test("accepts a 0.6 capability document", async () => {
		const { run, calls } = recordingRunner({
			exitCode: 0,
			stdout: `${JSON.stringify(FULL_DOCUMENT)}\n`,
			stderr: "",
		});
		const result = await negotiateCliCapabilities("/opt/beskid", run);
		expect(result.compatible).toBe(true);
		if (result.compatible) {
			expect(result.document.cliVersion).toBe("0.6.0");
		}
		expectOnlyCapabilityProbe(calls);
	});

	test("missing commands produce upgrade guidance", async () => {
		const { run, calls } = recordingRunner({
			exitCode: 0,
			stdout: JSON.stringify({
				...FULL_DOCUMENT,
				commands: FULL_DOCUMENT.commands.filter((c) => c !== "check"),
				devCommands: FULL_DOCUMENT.devCommands.filter((c) => c !== "lsp"),
			}),
			stderr: "",
		});
		const result = await negotiateCliCapabilities("/opt/beskid", run);
		expect(result.compatible).toBe(false);
		if (!result.compatible) {
			expect(result.missing).toEqual(["check", "dev lsp"]);
			expect(result.guidance).toBe(
				"Beskid CLI /opt/beskid does not support the 0.6 command surface " +
					"(missing: check, dev lsp). Run `beskid toolchain update` or install Beskid 0.6.",
			);
		}
		expectOnlyCapabilityProbe(calls);
	});

	test("document without devCommands is incompatible", async () => {
		const { run } = recordingRunner({
			exitCode: 0,
			stdout: JSON.stringify({
				schemaVersion: 1,
				cliVersion: "0.6.0",
				commands: FULL_DOCUMENT.commands,
				outputSchemas: [],
			}),
			stderr: "",
		});
		const result = await negotiateCliCapabilities("/opt/beskid", run);
		expect(result.compatible).toBe(false);
		if (!result.compatible) {
			expect(result.missing).toEqual(["dev lsp", "dev project"]);
		}
	});

	test("nonzero exit (0.5 CLI) produces upgrade guidance", async () => {
		const { run, calls } = recordingRunner({
			exitCode: 2,
			stdout: "",
			stderr: "error: unrecognized subcommand 'dev'",
		});
		const result = await negotiateCliCapabilities("/usr/bin/beskid", run);
		expect(result.compatible).toBe(false);
		if (!result.compatible) {
			expect(result.missing).toEqual(["dev capabilities"]);
			expect(result.guidance).toContain("does not support the 0.6 command surface");
			expect(result.guidance).toContain("beskid toolchain update");
			expect(result.detail).toContain("exit 2");
		}
		expectOnlyCapabilityProbe(calls);
	});

	test("invalid JSON is incompatible", async () => {
		const { run, calls } = recordingRunner({
			exitCode: 0,
			stdout: "beskid 0.6.0",
			stderr: "",
		});
		const result = await negotiateCliCapabilities("/opt/beskid", run);
		expect(result.compatible).toBe(false);
		expectOnlyCapabilityProbe(calls);
	});

	test("spawn failure is reported with the errno", async () => {
		const error = Object.assign(new Error("spawn beskid ENOENT"), {
			code: "ENOENT",
		});
		const { run, calls } = recordingRunner(error);
		const result = await negotiateCliCapabilities("beskid", run);
		expect(result.compatible).toBe(false);
		if (!result.compatible) {
			expect(result.spawnError?.code).toBe("ENOENT");
			expect(result.guidance).toContain("beskid toolchain update");
		}
		expectOnlyCapabilityProbe(calls);
	});
});

describe("parseCliCapabilities", () => {
	test("rejects unsupported schema versions", () => {
		expect(
			parseCliCapabilities(JSON.stringify({ ...FULL_DOCUMENT, schemaVersion: 2 })),
		).toBeUndefined();
	});
});
