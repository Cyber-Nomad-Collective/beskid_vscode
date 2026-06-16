import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { sendFocusedProjectConfiguration } from "../lsp/beskidLanguageClient.js";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";
import {
  loadFocusedProject,
  saveFocusedProject,
  type FocusedProjectState,
} from "../workspace/focusState.js";
import {
  readAutoSelectFromEditorEnabled,
  resolveProjectUriForEditor,
} from "../workspace/discovery.js";

export type FocusChangeListener = (state: FocusedProjectState) => void;

export class FocusCoordinator {
  private focused: vscode.Uri | undefined;
  private readonly listeners = new Set<FocusChangeListener>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel?: vscode.OutputChannel,
  ) {
    this.focused = loadFocusedProject(context);
  }

  getFocusedProject(): vscode.Uri | undefined {
    return this.focused;
  }

  onDidChangeFocus(listener: FocusChangeListener): vscode.Disposable {
    this.listeners.add(listener);
    listener({ projectUri: this.focused });
    return new vscode.Disposable(() => this.listeners.delete(listener));
  }

  private notify(): void {
    const state = { projectUri: this.focused };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  async setFocusedProject(
    uri: vscode.Uri | undefined,
    client: LanguageClient | undefined,
    refresh?: RefreshCoordinator,
  ): Promise<void> {
    const prev = this.focused?.toString();
    const next = uri?.toString();
    if (prev === next) {
      return;
    }
    this.focused = uri;
    await saveFocusedProject(this.context, uri);
    this.notify();
    if (client) {
      await sendFocusedProjectConfiguration(client, uri, this.outputChannel);
    }
    if (refresh) {
      refresh.scheduleFocusUi();
    }
  }

  async clearFocus(
    client: LanguageClient | undefined,
    refresh?: RefreshCoordinator,
  ): Promise<void> {
    await this.setFocusedProject(undefined, client, refresh);
  }

  async autoSelectFromActiveEditor(
    client: LanguageClient | undefined,
    refresh?: RefreshCoordinator,
  ): Promise<void> {
    if (!readAutoSelectFromEditorEnabled()) {
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const project = await resolveProjectUriForEditor(editor.document);
    if (!project) {
      return;
    }
    await this.setFocusedProject(project, client, refresh);
  }

  registerAutoSelect(
    clientProvider: () => LanguageClient | undefined,
    refresh?: RefreshCoordinator,
  ): vscode.Disposable {
    return vscode.window.onDidChangeActiveTextEditor(() => {
      void this.autoSelectFromActiveEditor(clientProvider(), refresh);
    });
  }
}
