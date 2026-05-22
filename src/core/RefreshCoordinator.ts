import type { LanguageClient } from "vscode-languageclient/node";
import { WATCH_REFRESH_DEBOUNCE_MS } from "../constants.js";
import { requestWorkspaceRefresh } from "../lsp/beskidLanguageClient.js";
import type { ProjectTreeProvider } from "../workspace/ProjectTreeProvider.js";
import type { WorkspaceTreeProvider } from "../workspace/WorkspaceTreeProvider.js";
import { debounce } from "./debounce.js";

export type RefreshScope = {
  lsp?: boolean;
  workspaceTree?: boolean;
  projectTree?: boolean;
};

export type RefreshCoordinatorDeps = {
  getClient: () => LanguageClient | undefined;
  workspaceTree: WorkspaceTreeProvider;
  projectTree: ProjectTreeProvider;
};

const FULL_REFRESH: RefreshScope = {
  lsp: true,
  workspaceTree: true,
  projectTree: true,
};

export class RefreshCoordinator {
  private readonly debouncedWatcher: ReturnType<typeof debounce>;

  constructor(private readonly deps: RefreshCoordinatorDeps) {
    this.debouncedWatcher = debounce(() => {
      void this.run(FULL_REFRESH);
    }, WATCH_REFRESH_DEBOUNCE_MS);
  }

  scheduleDebouncedFull(): void {
    this.debouncedWatcher.schedule();
  }

  scheduleFocusUi(): void {
    void this.run({ projectTree: true });
  }

  async scheduleFull(): Promise<void> {
    await this.run(FULL_REFRESH);
  }

  async run(scope: RefreshScope): Promise<void> {
    if (scope.lsp) {
      await requestWorkspaceRefresh(this.deps.getClient());
    }
    if (scope.workspaceTree) {
      this.deps.workspaceTree.refresh();
    }
    if (scope.projectTree) {
      this.deps.projectTree.refresh();
    }
  }
}
