import type {
	LspRuntimeSnapshot,
	LspSettingsFlags,
} from "../../src/runtime/lspRuntimeTypes.js";

export const defaultLspSettingsFlags = (): LspSettingsFlags => ({
	devMode: false,
	explicitServerPath: "",
	configuredCliPath: "beskid",
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
