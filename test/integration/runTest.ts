import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
	const profileRoot = mkdtempSync(path.join(tmpdir(), "beskid-vscode-test-"));
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
		const compilerRoot = path.resolve(extensionDevelopmentPath, "../compiler");
		const binaryName = process.platform === "win32" ? "beskid_lsp.exe" : "beskid_lsp";
		const configuredLspPath = process.env.BESKID_TEST_LSP_PATH?.trim();
		const lspPath = configuredLspPath
			? path.resolve(configuredLspPath)
			: path.join(compilerRoot, "target", "release", binaryName);
		if (!configuredLspPath) {
			const build = spawnSync(
				"cargo",
				["build", "-p", "beskid_lsp", "--release"],
				{
					cwd: compilerRoot,
					stdio: "inherit",
					env: { ...process.env, RUSTC_WRAPPER: "" },
				},
			);
			if (build.status !== 0) {
				throw new Error(`failed to build integration LSP (exit ${build.status})`);
			}
		}
		if (!existsSync(lspPath)) {
			throw new Error(`integration LSP missing at ${lspPath}`);
		}

		const extensionTestsPath = path.join(__dirname, "suite");
		const workspace = path.join(
			extensionDevelopmentPath,
			"test/fixtures/workspace",
		);
		const userDataDir = path.join(profileRoot, "user-data");
		const userSettingsDir = path.join(userDataDir, "User");
		mkdirSync(userSettingsDir, { recursive: true });
		writeFileSync(
			path.join(userSettingsDir, "settings.json"),
			`${JSON.stringify(
				{
					"beskid.lsp.server.path": lspPath,
					"beskid.toolchain.autoInstallOnLaunch": false,
				},
				null,
				2,
			)}\n`,
			"utf8",
		);

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [
				workspace,
				"--disable-extensions",
				`--user-data-dir=${userDataDir}`,
				`--extensions-dir=${path.join(profileRoot, "extensions")}`,
			],
		});
	} catch (error) {
		console.error("Beskid VS Code integration tests failed:", error);
		process.exitCode = 1;
	} finally {
		rmSync(profileRoot, { recursive: true, force: true });
	}
}

void main();
