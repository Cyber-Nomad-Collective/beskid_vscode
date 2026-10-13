import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CliProcessRunner } from "../src/cli/cliCapabilities.js";
import {
	CLI_CAPABILITIES_ARGS,
	cliLspInstallArgs,
} from "../src/cli/cliCommandSurface.js";
import type { CliProcessResult } from "../src/cli/cliProcess.js";
import { installBeskidLsp } from "../src/cli/lspInstall.js";

const CAPABILITIES = JSON.stringify({
	schemaVersion: 1,
	cliVersion: "0.6.0",
	commands: ["check", "build", "test", "dev"],
	devCommands: ["lsp", "project", "capabilities"],
	outputSchemas: [],
});

function scriptedRunner(
	responses: Record<string, CliProcessResult>,
): { run: CliProcessRunner; calls: string[][] } {
	const calls: string[][] = [];
	const run: CliProcessRunner = async (_command, args) => {
		calls.push(args);
		const response = responses[args.slice(0, 3).join(" ")];
		if (!response) {
			throw new Error(`unexpected argv: ${args.join(" ")}`);
		}
		return response;
	};
	return { run, calls };
}

const capabilitiesOk = {
	"dev capabilities --json": { exitCode: 0, stdout: CAPABILITIES, stderr: "" },
};

const output = () => {
	const lines: string[] = [];
	return { lines, channel: { appendLine: (line: string) => lines.push(line) } };
};

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
beforeAll(() => {
	globalThis.fetch = (async () => {
		fetchCalls += 1;
		throw new Error("direct download attempted");
	}) as unknown as typeof fetch;
});
afterAll(() => {
	globalThis.fetch = originalFetch;
});

afterEach(() => {
	expect(fetchCalls).toBe(0);
});

describe("cliLspInstallArgs", () => {
	test("builds `dev lsp install --release-tag <tag>`", () => {
		expect(cliLspInstallArgs("lsp-v0.6.0")).toEqual([
			"dev",
			"lsp",
			"install",
			"--release-tag",
			"lsp-v0.6.0",
		]);
		expect(cliLspInstallArgs()).toEqual(["dev", "lsp", "install"]);
	});
});

describe("installBeskidLsp", () => {
	test("installs through `beskid dev lsp install` without downloading", async () => {
		const { run, calls } = scriptedRunner({
			...capabilitiesOk,
			"dev lsp install": {
				exitCode: 0,
				stdout:
					"Fetching version from x\nInstalled Beskid LSP 0.6.0 (lsp-v0.6.0) → /home/u/.beskid/bin/beskid_lsp\n",
				stderr: "",
			},
		});
		const { lines, channel } = output();
		const result = await installBeskidLsp("/opt/beskid", channel, "lsp-stable", {
			run,
			resolveTag: async () => "lsp-v0.6.0",
			installPath: () => "/home/u/.beskid/bin/beskid_lsp",
			exists: () => true,
		});
		expect(calls).toEqual([
			[...CLI_CAPABILITIES_ARGS],
			["dev", "lsp", "install", "--release-tag", "lsp-v0.6.0"],
		]);
		expect(result).toEqual({
			path: "/home/u/.beskid/bin/beskid_lsp",
			version: "0.6.0",
			releaseTag: "lsp-v0.6.0",
		});
		expect(lines.join("\n")).toContain("Installed Beskid LSP 0.6.0");
	});

	test("incompatible CLI fails closed before any install", async () => {
		const { run, calls } = scriptedRunner({
			"dev capabilities --json": {
				exitCode: 2,
				stdout: "",
				stderr: "error: unrecognized subcommand 'dev'",
			},
		});
		const { channel } = output();
		await expect(
			installBeskidLsp("/usr/bin/beskid", channel, "lsp-stable", {
				run,
				resolveTag: async (tag) => tag,
				installPath: () => "/x/beskid_lsp",
				exists: () => true,
			}),
		).rejects.toThrow("Run `beskid toolchain update` or install Beskid 0.6.");
		expect(calls).toEqual([[...CLI_CAPABILITIES_ARGS]]);
	});

	test("surfaces CLI install failures", async () => {
		const { run } = scriptedRunner({
			...capabilitiesOk,
			"dev lsp install": {
				exitCode: 1,
				stdout: "",
				stderr: "Error: no published LSP build for linux-aarch64",
			},
		});
		const { lines, channel } = output();
		await expect(
			installBeskidLsp("/opt/beskid", channel, "lsp-stable", {
				run,
				resolveTag: async (tag) => tag,
				installPath: () => "/x/beskid_lsp",
				exists: () => true,
			}),
		).rejects.toThrow("no published LSP build for linux-aarch64");
		expect(lines.join("\n")).toContain("exit 1");
	});

	test("fails when the CLI reports success but no binary exists", async () => {
		const { run } = scriptedRunner({
			...capabilitiesOk,
			"dev lsp install": { exitCode: 0, stdout: "", stderr: "" },
		});
		const { channel } = output();
		await expect(
			installBeskidLsp("/opt/beskid", channel, "lsp-stable", {
				run,
				resolveTag: async (tag) => tag,
				installPath: () => "/x/beskid_lsp",
				exists: () => false,
			}),
		).rejects.toThrow("/x/beskid_lsp does not exist");
	});
});

test("lspInstall source has no direct download path", () => {
	const source = readFileSync(
		join(import.meta.dir, "..", "src", "cli", "lspInstall.ts"),
		"utf8",
	);
	expect(source).not.toMatch(/\bfetch\(|releases\/download|writeFileSync/);
});
