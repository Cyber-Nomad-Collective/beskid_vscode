import { expect, test } from "bun:test";
import pkg from "../package.json";

test("package.json declares the runtime ABI the bundled toolchain uses", () => {
	expect(pkg.beskidToolchain.runtimeAbi).toBeGreaterThan(0);
});

test("the extension no longer contributes toolchain download commands or settings", () => {
	const commands = pkg.contributes.commands.map((c) => c.command);
	for (const gone of ["beskid.cli.install", "beskid.lsp.install", "beskid.cli.bootstrap"]) {
		expect(commands).not.toContain(gone);
	}
	expect(commands).toContain("beskid.toolchain.removeStale");
	const keys = pkg.contributes.configuration.flatMap((s) => Object.keys(s.properties));
	for (const gone of ["beskid.cli.releaseTag", "beskid.lsp.releaseTag", "beskid.toolchain.autoInstallOnLaunch"]) {
		expect(keys).not.toContain(gone);
	}
});

test("package-lock.json matches the extension manifest version", async () => {
	const lock = await import("../package-lock.json");
	expect(lock.version).toBe(pkg.version);
	expect(lock.packages[""].version).toBe(pkg.version);
});

test("settings that choose a program to run, or where the registry key goes, are machine-scoped", () => {
	// A workspace's `.vscode/settings.json` must not point VS Code at an arbitrary binary or
	// command, or send the user's registry key elsewhere: VS Code ignores workspace values of
	// machine-scoped settings.
	const properties: Record<string, { scope?: string }> = Object.assign(
		{},
		...pkg.contributes.configuration.map((section) => section.properties),
	);
	const guarded = [
		"beskid.lsp.server.command",
		"beskid.lsp.server.args",
		"beskid.lsp.server.debugArgs",
		"beskid.lsp.server.devMode",
		"beskid.lsp.server.path",
		"beskid.lsp.server.cwd",
		"beskid.cli.path",
		"beskid.pckg.baseUrl",
	];
	for (const key of guarded) {
		expect({ key, scope: properties[key]?.scope }).toEqual({ key, scope: "machine" });
	}
	// Any later setting that names a program, its arguments or its directory must be guarded too.
	for (const [key, property] of Object.entries(properties)) {
		if (/\.(path|command|args|debugArgs|cwd)$/.test(key)) {
			expect({ key, scope: property.scope }).toEqual({ key, scope: "machine" });
		}
	}
});
