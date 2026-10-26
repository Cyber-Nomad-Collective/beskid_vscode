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
	expect(commands).toContain("beskid.migrateLock");
	const keys = pkg.contributes.configuration.flatMap((s) => Object.keys(s.properties));
	for (const gone of ["beskid.cli.releaseTag", "beskid.lsp.releaseTag", "beskid.toolchain.autoInstallOnLaunch"]) {
		expect(keys).not.toContain(gone);
	}
});

test("package.json and package-lock.json carry the 0.6.7 release version", async () => {
	const lock = await import("../package-lock.json");
	expect(pkg.version).toBe("0.6.7");
	expect(lock.version).toBe(pkg.version);
	expect(lock.packages[""].version).toBe(pkg.version);
});
