import { describe, expect, test, mock } from "bun:test";
import type { LspRuntimeSnapshot } from "../src/runtime/lspRuntimeTypes.js";
import { testRuntimeSnapshot } from "./fixtures/lspRuntimeSnapshot.js";

type ChangeListener = (snapshot: LspRuntimeSnapshot) => void;

function createRuntimeMock(initial: Partial<LspRuntimeSnapshot> = {}) {
  let snapshot = testRuntimeSnapshot(initial);
  const listeners = new Set<ChangeListener>();
  return {
    getSnapshot: () => snapshot,
    onDidChange: (listener: ChangeListener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
}

describe("registerRuntimeUi status dashboard", () => {
  test("registers BeskidModalPanel webview provider and dashboard commands", async () => {
    const subscriptions: unknown[] = [];
    const registeredCommands = new Map<string, unknown>();
    const registerWebviewViewProvider = mock(() => ({ dispose: () => undefined }));
    const registerCommand = mock((id: string, handler: unknown) => {
      registeredCommands.set(id, handler);
      return { dispose: () => registeredCommands.delete(id) };
    });

    mock.module("vscode", () => ({
      window: { registerWebviewViewProvider },
      commands: {
        registerCommand,
        executeCommand: mock(async () => undefined),
      },
      workspace: {
        getConfiguration: () => ({
          get: (_key: string, defaultValue?: unknown) => defaultValue,
        }),
        workspaceFolders: [],
      },
    }));

    const { registerRuntimeUi } = await import("../src/activation/registerRuntimeUi.js");
    const runtime = createRuntimeMock();
    const handles = registerRuntimeUi({ subscriptions } as never, runtime as never, "0.2.0");

    expect(handles.modal).toBeDefined();
    expect(registerWebviewViewProvider).toHaveBeenCalled();
    expect(registeredCommands.has("beskid.modal.open")).toBe(true);
    expect(registeredCommands.has("beskid.dashboard.focus")).toBe(true);
    expect(subscriptions.length).toBeGreaterThan(0);
  });
});
