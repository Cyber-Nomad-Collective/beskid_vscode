import type * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { WATCH_REFRESH_DEBOUNCE_MS } from "../constants.js";
import { requestWorkspaceRefresh } from "../lsp/beskidLanguageClient.js";
import type { ProjectsTreeProvider } from "../workspace/ProjectsTreeProvider.js";
import { debounce } from "./debounce.js";

export type RefreshScope = {
	lsp?: boolean;
	projectsTree?: boolean;
};

export type RefreshCoordinatorDeps = {
	getClient: () => LanguageClient | undefined;
	projectsTree: ProjectsTreeProvider;
	outputChannel?: vscode.OutputChannel;
};

const FULL_REFRESH: RefreshScope = {
	lsp: true,
	projectsTree: true,
};

export class RefreshCoordinator {
	private readonly debouncedWatcher: ReturnType<typeof debounce>;
	private readonly debouncedLspReady: ReturnType<typeof debounce>;

	constructor(private readonly deps: RefreshCoordinatorDeps) {
		this.debouncedWatcher = debounce(() => {
			void this.run(FULL_REFRESH);
		}, WATCH_REFRESH_DEBOUNCE_MS);
		this.debouncedLspReady = debounce(() => {
			void this.run(FULL_REFRESH);
		}, WATCH_REFRESH_DEBOUNCE_MS);
	}

	scheduleDebouncedFull(): void {
		this.debouncedWatcher.schedule();
	}

	scheduleLspReady(): void {
		this.debouncedLspReady.schedule();
	}

	scheduleFocusUi(): void {
		void this.run({ projectsTree: true });
	}

	async scheduleFull(): Promise<void> {
		await this.run(FULL_REFRESH);
	}

	async run(scope: RefreshScope): Promise<void> {
		if (scope.lsp) {
			await requestWorkspaceRefresh(
				this.deps.getClient(),
				this.deps.outputChannel,
			);
		}
		if (scope.projectsTree) {
			this.deps.projectsTree.refresh();
		}
	}
}
