import { describe, expect, test, mock, beforeEach } from "bun:test";
import { BESKID_TREE_VIEW_IDS } from "../src/views/beskidViewIds.js";

type TreeViewStub = { id: string; dispose: () => void };

function createMockVscode() {
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
    module: {
      window: {
        createTreeView,
      },
    },
  };
}

describe("registerViews", () => {
  beforeEach(() => {
    mock.restore();
  });

  test("registers every tree view with createTreeView", async () => {
    const mockVscode = createMockVscode();
    mock.module("vscode", () => mockVscode.module);

    const { registerViews } = await import("../src/activation/registerViews.js");

    const deps = {
      workspaceTree: { onDidChangeTreeData: undefined },
      projectTree: { onDidChangeTreeData: undefined },
      packageProvider: { onDidChangeTreeData: undefined },
      outlineProvider: { onDidChangeTreeData: undefined },
      debugProvider: { onDidChangeTreeData: undefined },
    };

    const context = { subscriptions: mockVscode.subscriptions };
    const registered = registerViews(context as never, deps as never);

    expect(mockVscode.module.window.createTreeView).toHaveBeenCalledTimes(BESKID_TREE_VIEW_IDS.length);
    for (const viewId of BESKID_TREE_VIEW_IDS) {
      expect(mockVscode.treeViews.has(viewId)).toBe(true);
      expect(mockVscode.module.window.createTreeView).toHaveBeenCalledWith(
        viewId,
        expect.objectContaining({ treeDataProvider: expect.anything() }),
      );
    }

    expect(registered.debugTreeView.id).toBe("beskidDebugView");
    expect(mockVscode.subscriptions.length).toBe(BESKID_TREE_VIEW_IDS.length);
  });
});
