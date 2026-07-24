import { runCliProcess } from "./cliProcess.js";

/** True when the CLI binary implements `beskid lsp` (added in rolling CLI releases). */
export async function cliSupportsLsp(cliPath: string): Promise<boolean> {
	try {
		const result = await runCliProcess(cliPath, ["lsp", "--help"]);
		return result.exitCode === 0;
	} catch {
		return false;
	}
}
