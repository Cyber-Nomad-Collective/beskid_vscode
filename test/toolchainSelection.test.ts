import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	identitiesMatch,
	selectCli,
	selectServer,
	staleToolchainMessage,
	type ToolchainDeps,
	type ToolchainIdentity,
} from "../src/cli/toolchainSelection.js";

const expected: ToolchainIdentity = { version: "0.6.7", runtimeAbi: 5 };
const managedDir = join("/home/u", ".beskid", "bin");
const managedCli = join(managedDir, "beskid");
const managedServer = join(managedDir, "beskid_lsp");

function deps(
	files: string[],
	identities: Record<string, ToolchainIdentity | undefined> = {},
): ToolchainDeps & { probed: string[] } {
	const probed: string[] = [];
	return {
		probed,
		exists: (path) => files.includes(path),
		probe: async (path) => {
			probed.push(path);
			return identities[path];
		},
	};
}

const base = {
	expected,
	explicitServerPath: undefined,
	bundledServerPath: undefined,
	managedDir,
	platform: "linux" as NodeJS.Platform,
};

describe("identitiesMatch", () => {
	test("requires equal version and runtime ABI", () => {
		expect(identitiesMatch(expected, { version: "0.6.7", runtimeAbi: 5 })).toBe(true);
		expect(identitiesMatch(expected, { version: "v0.6.7", runtimeAbi: 5 })).toBe(true);
		expect(identitiesMatch(expected, { version: "0.6.6", runtimeAbi: 5 })).toBe(false);
		expect(identitiesMatch(expected, { version: "0.6.7", runtimeAbi: 4 })).toBe(false);
	});

	test("fails closed when the ABI or the answer is missing", () => {
		expect(identitiesMatch(expected, { version: "0.6.7", runtimeAbi: undefined })).toBe(false);
		expect(identitiesMatch(expected, undefined)).toBe(false);
		expect(
			identitiesMatch({ version: "0.6.7", runtimeAbi: undefined }, { version: "0.6.7", runtimeAbi: 5 }),
		).toBe(false);
	});
});

describe("selectServer order", () => {
	test("explicit setting wins over bundled and managed", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.6.7", runtimeAbi: 5 },
		});
		const result = await selectServer(
			{ ...base, explicitServerPath: "/x/beskid_lsp", bundledServerPath: "/ext/server/beskid_lsp" },
			d,
		);
		expect(result.source).toBe("explicit");
		expect(result.serverPath).toBe("/x/beskid_lsp");
	});

	test("bundled server wins over a matching managed toolchain", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.6.7", runtimeAbi: 5 },
		});
		const result = await selectServer(
			{ ...base, bundledServerPath: "/ext/server/beskid_lsp" },
			d,
		);
		expect(result.source).toBe("bundled");
		expect(result.stale).toBeUndefined();
		expect(result.managedCliPath).toBe(managedCli);
	});

	test("bundled server gets no managed CLI when the managed toolchain is stale", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.6.6", runtimeAbi: 5 },
		});
		const result = await selectServer(
			{ ...base, bundledServerPath: "/ext/server/beskid_lsp" },
			d,
		);
		expect(result.managedCliPath).toBeUndefined();
	});

	test("managed toolchain is used only when version and ABI match", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.6.7", runtimeAbi: 5 },
		});
		const result = await selectServer(base, d);
		expect(result.source).toBe("managed");
		expect(result.serverPath).toBe(managedServer);
		expect(result.siblingCliPath).toBe(managedCli);
	});

	test("managed toolchain with another version is stale and not used", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.6.6", runtimeAbi: 5 },
		});
		const result = await selectServer(base, d);
		expect(result.source).toBe("none");
		expect(result.stale?.files).toEqual([managedServer, managedCli]);
		expect(staleToolchainMessage(result.stale!, expected)).toContain("0.6.6");
	});

	test("managed toolchain with another runtime ABI is stale", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.6.7", runtimeAbi: 4 },
		});
		expect((await selectServer(base, d)).stale).toBeDefined();
	});

	test("stale toolchain is reported even when the bundled server runs", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.5.2", runtimeAbi: undefined },
		});
		const result = await selectServer(
			{ ...base, bundledServerPath: "/ext/server/beskid_lsp" },
			d,
		);
		expect(result.source).toBe("bundled");
		expect(result.stale?.dir).toBe(managedDir);
	});

	test("a managed server without its CLI cannot be verified", async () => {
		const result = await selectServer(base, deps([managedServer]));
		expect(result.source).toBe("none");
		expect(result.stale?.files).toEqual([managedServer]);
	});

	test("nothing installed is not stale", async () => {
		const result = await selectServer(base, deps([]));
		expect(result).toEqual({ source: "none" });
	});
});

describe("selectCli order", () => {
	const noServer = { source: "none" as const };

	test("explicit setting first, without probing", async () => {
		const d = deps([]);
		const result = await selectCli(
			{ expected, explicitCliPath: "/c/beskid", server: noServer, pathCommand: "beskid" },
			d,
		);
		expect(result).toEqual({ source: "explicit", cliPath: "/c/beskid" });
		expect(d.probed).toEqual([]);
	});

	test("then the CLI of the server's toolchain", async () => {
		const result = await selectCli(
			{
				expected,
				explicitCliPath: undefined,
				server: { source: "bundled", serverPath: "/e/beskid_lsp", siblingCliPath: "/e/beskid" },
				pathCommand: "beskid",
			},
			deps([]),
		);
		expect(result).toEqual({ source: "toolchain", cliPath: "/e/beskid" });
	});

	test("then the matching managed CLI for the bundled server, before PATH", async () => {
		const d = deps([], { beskid: { version: "0.6.7", runtimeAbi: 5 } });
		const result = await selectCli(
			{
				expected,
				explicitCliPath: undefined,
				server: { source: "bundled", serverPath: "/e/beskid_lsp", managedCliPath: managedCli },
				pathCommand: "beskid",
			},
			d,
		);
		expect(result).toEqual({ source: "managed", cliPath: managedCli });
		expect(d.probed).toEqual([]);
	});

	test("bundled server selected end to end uses the managed CLI", async () => {
		const d = deps([managedServer, managedCli], {
			[managedCli]: { version: "0.6.7", runtimeAbi: 5 },
			beskid: { version: "0.6.7", runtimeAbi: 5 },
		});
		const server = await selectServer({ ...base, bundledServerPath: "/ext/server/beskid_lsp" }, d);
		const cli = await selectCli(
			{ expected, explicitCliPath: undefined, server, pathCommand: "beskid" },
			d,
		);
		expect(cli).toEqual({ source: "managed", cliPath: managedCli });
	});

	test("then PATH, only when the version and ABI match", async () => {
		const ok = await selectCli(
			{ expected, explicitCliPath: undefined, server: noServer, pathCommand: "beskid" },
			deps([], { beskid: { version: "0.6.7", runtimeAbi: 5 } }),
		);
		expect(ok).toEqual({ source: "path", cliPath: "beskid" });

		const old = await selectCli(
			{ expected, explicitCliPath: undefined, server: noServer, pathCommand: "beskid" },
			deps([], { beskid: { version: "0.6.6", runtimeAbi: 5 } }),
		);
		expect(old.source).toBe("none");
		if (old.source === "none") {
			expect(old.reason).toContain("0.6.6");
		}
	});

	test("PATH without a CLI yields none", async () => {
		const result = await selectCli(
			{ expected, explicitCliPath: undefined, server: noServer, pathCommand: "beskid" },
			deps([]),
		);
		expect(result.source).toBe("none");
	});
});
