type MockSection = Record<string, unknown>;

type VscodeMockOverrides = Record<string, unknown> & {
	commands?: MockSection;
	Uri?: MockSection;
	window?: MockSection;
	workspace?: MockSection;
};

/** Complete shared surface for Bun's process-global `vscode` module mock. */
export function completeVscodeMock(overrides: VscodeMockOverrides = {}) {
	const defaults = {
		TreeItem: class TreeItem {
			description?: string;
			iconPath?: unknown;
			command?: unknown;
			resourceUri?: unknown;
			tooltip?: string;
			contextValue?: string;

			constructor(
				public label: string,
				public collapsibleState: number,
			) {}
		},
		ThemeIcon: class ThemeIcon {
			constructor(public readonly id: string) {}
		},
		TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
		EventEmitter: class EventEmitter<T> {
			event = () => ({ dispose: () => undefined });
			fire(_value: T) {}
			dispose() {}
		},
		window: {
			createTreeView: (id: string) => ({ id, dispose: () => undefined }),
			registerWebviewViewProvider: () => ({ dispose: () => undefined }),
		},
		commands: {
			registerCommand: () => ({ dispose: () => undefined }),
			executeCommand: async () => undefined,
		},
		workspace: {
			getConfiguration: () => ({
				get: (_key: string, defaultValue?: unknown) => defaultValue,
			}),
			onDidChangeConfiguration: () => ({ dispose: () => undefined }),
			workspaceFolders: [],
			asRelativePath: (uri: { fsPath?: string } | string) => String(uri),
			findFiles: async () => [],
		},
		Uri: {
			parse: (value: string) => ({ fsPath: value.replace(/^file:\/\//, "") }),
			file: (value: string) => ({ fsPath: value }),
		},
	};

	return {
		...defaults,
		...overrides,
		window: { ...defaults.window, ...overrides.window },
		commands: { ...defaults.commands, ...overrides.commands },
		workspace: { ...defaults.workspace, ...overrides.workspace },
		Uri: { ...defaults.Uri, ...overrides.Uri },
	};
}
