import type {
	LspRuntimeSnapshot,
	LspSettingsFlags,
} from "../../src/runtime/lspRuntimeTypes.js";

export const defaultLspSettingsFlags = (): LspSettingsFlags => ({
	devMode: false,
	preferBundled: false,
	explicitServerPath: "",
	lspReleaseTag: "lsp-stable",
	configuredCliPath: "beskid",
	cliReleaseTag: "cli-stable",
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
