import type {
	LspRuntimeSnapshot,
	LspSettingsFlags,
} from "../../src/runtime/lspRuntimeTypes.js";

export const defaultLspSettingsFlags = (): LspSettingsFlags => ({
	devMode: false,
	preferBundled: false,
	explicitServerPath: "",
	lspReleaseTag: "lsp-latest",
	configuredCliPath: "beskid",
	cliReleaseTag: "cli-latest",
	autoFetchDependencies: true,
	autoSelectFromEditor: true,
	logLevel: "info",
	logServerOutput: true,
	pckgBaseUrl: "http://localhost:5000",
});

export function testRuntimeSnapshot(
	overrides: Partial<LspRuntimeSnapshot> = {},
): LspRuntimeSnapshot {
	return {
		phase: "running",
		scan: { active: false },
		workspaceRoots: [],
		settingsFlags: defaultLspSettingsFlags(),
		...overrides,
	};
}
