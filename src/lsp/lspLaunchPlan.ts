import type { ServerSelection } from "../cli/toolchainSelection.js";

/**
 * How the language server starts. Pure module: no `vscode` import.
 *
 * Only the selected server (explicit setting, bundled, or matching
 * `~/.beskid/bin`) or the explicit dev mode can start it. A
 * `compiler/target/release/beskid_lsp` found near the workspace is never run:
 * the server exposes no runtime ABI, so its identity cannot be checked.
 */
export type LspLaunchPlan =
	| { kind: "binary"; serverPath: string }
	| { kind: "dev" }
	| { kind: "none" };

export function planLspLaunch(
	selection: Pick<ServerSelection, "source" | "serverPath">,
	devMode: boolean,
): LspLaunchPlan {
	if (selection.serverPath && (selection.source === "explicit" || !devMode)) {
		return { kind: "binary", serverPath: selection.serverPath };
	}
	return devMode ? { kind: "dev" } : { kind: "none" };
}
