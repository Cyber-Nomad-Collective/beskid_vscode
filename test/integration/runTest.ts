import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
		const extensionTestsPath = path.join(__dirname, "suite");
		const workspace = path.join(
			extensionDevelopmentPath,
			"test/fixtures/workspace",
		);

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [workspace, "--disable-extensions"],
		});
	} catch (error) {
		console.error("Beskid VS Code integration tests failed:", error);
		process.exit(1);
	}
}

void main();
