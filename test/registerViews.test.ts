import { describe, expect, test, mock, beforeEach } from "bun:test";
import { BESKID_TREE_VIEW_IDS } from "../src/views/beskidViewIds.js";
import { completeVscodeMock } from "./fixtures/vscodeMock.js";

type TreeViewStub = { id: string; dispose: () => void };

function createMockVscode(debugEnabled = false) {
  class TreeItem {
    constructor(
      public label: string,
      public collapsibleState: number,
    ) {}
  }

  const subscriptions: unknown[] = [];
  const treeViews = new Map<string, TreeViewStub>();

  const createTreeView = mock((viewId: string) => {
    const view: TreeViewStub = {
      id: viewId,
      dispose: mock(() => undefined),
    };
    treeViews.set(viewId, view);
    return view;
  });

  return {
    subscriptions,
    treeViews,
    module: completeVscodeMock({
      TreeItem,
      window: {
        createTreeView,
      },
      workspace: {
        getConfiguration: () => ({
          get: (key: string, defaultValue: boolean) =>
            key === "debug.enabled" ? debugEnabled : defaultValue,
        }),
      },
    }),
  };
}

describe("registerViews", () => {
  test("registers core tree views with createTreeView", async () => {
    const mockVscode = createMockVscode(false);
    mock.module("vscode", () => mockVscode.module);

    const { registerViews } = await import("../src/activation/registerViews.js");

    const deps = {
      projectsTree: { onDidChangeTreeData: undefined },
      packageProvider: { onDidChangeTreeData: undefined },
      debugProvider: { onDidChangeTreeData: undefined },
    };

    const context = { subscriptions: mockVscode.subscriptions };
    const registered = registerViews(context as never, deps as never);

    expect(mockVscode.module.window.createTreeView).toHaveBeenCalledTimes(BESKID_TREE_VIEW_IDS.length);
    for (const viewId of BESKID_TREE_VIEW_IDS) {
      expect(mockVscode.treeViews.has(viewId)).toBe(true);
    }

    expect(registered.debugTreeView).toBeUndefined();
    expect(registered.projectsTreeView.id).toBe("beskidProjectsView");
  });

  test("registers debug tree when debug.enabled is true", async () => {
    const mockVscode = createMockVscode(true);
    mock.module("vscode", () => mockVscode.module);

    const { registerViews } = await import("../src/activation/registerViews.js");

    const deps = {
      projectsTree: { onDidChangeTreeData: undefined },
      packageProvider: { onDidChangeTreeData: undefined },
      debugProvider: { onDidChangeTreeData: undefined },
    };

    const registered = registerViews({ subscriptions: mockVscode.subscriptions } as never, deps as never);
    expect(registered.debugTreeView?.id).toBe("beskidDebugView");
  });
});
