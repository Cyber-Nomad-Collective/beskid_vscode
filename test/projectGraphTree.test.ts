import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { LspProjectApi } from "../src/workspace/lspProjectApi.js";
import { completeVscodeMock } from "./fixtures/vscodeMock.js";

function createMockVscode() {
  return completeVscodeMock({
    workspace: {
      asRelativePath: (uri: { fsPath: string }) => uri.fsPath,
    },
  });
}

function mockApi(overrides: Partial<LspProjectApi>): LspProjectApi {
  return {
    listWorkspaces: async () => ({ workspaces: [] }),
    getWorkspaceSummary: async () => ({ ok: false, error: "unavailable" }),
    getGraph: async () => ({ ok: false, error: "graph failed" }),
    getProjectDependencies: async () => ({ ok: false, error: "deps failed" }),
    ...overrides,
  } as LspProjectApi;
}

async function loadProjectGraphTree() {
  mock.module("vscode", () => createMockVscode());
  return import("../src/workspace/projectGraphTree.js");
}

describe("projectGraphTree degraded fallback", () => {
  beforeEach(() => {
    mock.module("vscode", () => createMockVscode());
  });

  test("dependencies section shows warning when LSP commands fail", async () => {
    const { projectSectionChildren } = await loadProjectGraphTree();
    const api = mockApi({
      getProjectDependencies: async () => ({ ok: false, error: "deps failed" }),
      getGraph: async () => ({ ok: false, error: "graph failed" }),
    });
    const result = await projectSectionChildren(
      api,
      "file:///tmp/missing/demo.bproj",
      "dependencies",
    );
    expect(result.error).toContain("deps failed");
    expect(result.items.some((item) => item.nodeType === "warning")).toBe(true);
  });

  test("dependencies section prefers getProjectDependencies before graph", async () => {
    const { projectSectionChildren } = await loadProjectGraphTree();
    let graphCalled = false;
    const api = mockApi({
      getProjectDependencies: async () => ({
        ok: true,
        value: {
          declared: [{ name: "corelib", version: "1.0.0" }],
          locked: [],
          unresolved: ["missing-lock"],
        },
      }),
      getGraph: async () => {
        graphCalled = true;
        return {
          ok: true,
          value: {
            kind: "projectDeps",
            mermaid: "",
            revision: "",
            warnings: [],
            metadata: { nodes: [] },
          },
        };
      },
    });
    const result = await projectSectionChildren(
      api,
      "file:///tmp/demo/demo.bproj",
      "dependencies",
    );
    expect(graphCalled).toBe(false);
    expect(result.items.map((item) => item.label)).toEqual(
      expect.arrayContaining(["corelib@1.0.0", "missing-lock"]),
    );
  });
});
