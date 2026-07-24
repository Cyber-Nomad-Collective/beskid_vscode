import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Mirrors LSP `PROJECT_EXPLORER_COMMANDS` — kept in sync via contract snapshot. */
export const PROJECT_EXPLORER_COMMANDS = [
	"beskid.refreshWorkspace",
	"beskid.listWorkspaces",
	"beskid.getWorkspaceSummary",
	"beskid.getGraph",
	"beskid.getProjectDependencies",
	"beskid.pckg.getConnectionStatus",
	"beskid.pckg.setRegistry",
	"beskid.pckg.validateConnection",
	"beskid.symbol.getDocumentationUri",
] as const;

type ContractSnapshot = {
	commands: string[];
	argumentShapes: Record<
		string,
		{
			args?: unknown[];
			uriKey?: string;
			acceptsBareString?: boolean;
			objectKeys?: string[];
		}
	>;
};

const PCKG_EXECUTE_COMMANDS = [
	"beskid.pckg.getConnectionStatus",
	"beskid.pckg.setRegistry",
	"beskid.pckg.validateConnection",
] as const;

function loadContractSnapshot(): ContractSnapshot {
	const path = join(
		import.meta.dirname,
		"fixtures/lsp-project-explorer-commands.json",
	);
	return JSON.parse(readFileSync(path, "utf8")) as ContractSnapshot;
}

describe("LSP execute command contracts", () => {
	const snapshot = loadContractSnapshot();

	test("explorer commands match committed Rust contract snapshot", () => {
		expect([...PROJECT_EXPLORER_COMMANDS]).toEqual(snapshot.commands);
	});

	test("explorer commands are unique", () => {
		expect(new Set(PROJECT_EXPLORER_COMMANDS).size).toBe(
			PROJECT_EXPLORER_COMMANDS.length,
		);
	});

	test("pckg commands are namespaced and advertised with explorer commands", () => {
		for (const cmd of PCKG_EXECUTE_COMMANDS) {
			expect(cmd.startsWith("beskid.pckg.")).toBe(true);
			expect(
				PROJECT_EXPLORER_COMMANDS.includes(
					cmd as (typeof PROJECT_EXPLORER_COMMANDS)[number],
				),
			).toBe(true);
		}
	});

	test("argument shapes document URI and object payloads", () => {
		expect(snapshot.argumentShapes["beskid.getWorkspaceSummary"]).toEqual({
			uriKey: "workspaceUri",
			acceptsBareString: true,
		});
		expect(snapshot.argumentShapes["beskid.getProjectDependencies"]).toEqual({
			uriKey: "projectUri",
			acceptsBareString: true,
		});
		expect(snapshot.argumentShapes["beskid.getGraph"]?.objectKeys).toContain(
			"projectUri",
		);
		expect(snapshot.argumentShapes["beskid.getGraph"]?.objectKeys).toContain(
			"workspaceUri",
		);
		expect(
			snapshot.argumentShapes["beskid.symbol.getDocumentationUri"]?.objectKeys,
		).toEqual(["uri", "offset"]);
	});

	test("extension does not manually register LSP execute commands", () => {
		const registrationSources = [
			"src/commands/explorerCommands.ts",
			"src/commands/graphCommands.ts",
			"src/commands/lspCommands.ts",
			"src/commands/packageCommands.ts",
			"src/commands/symbolCommands.ts",
			"src/cli/cliService.ts",
			"src/packages/PackageRegistryPanel.ts",
			"src/activation/registerRuntimeUi.ts",
			"src/dashboard/BeskidModalPanel.ts",
		];
		for (const relativePath of registrationSources) {
			const source = readFileSync(
				join(import.meta.dirname, "..", relativePath),
				"utf8",
			);
			for (const command of PROJECT_EXPLORER_COMMANDS) {
				expect(source).not.toContain(`registerCommand("${command}"`);
			}
		}
	});
});
