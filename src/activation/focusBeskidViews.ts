import * as vscode from "vscode";

const BESKID_VIEWS_CONTAINER = "workbench.view.extension.beskidViews";

/** Reveal the Beskid activity-bar container; ignores errors when it is already visible. */
export async function openBeskidViewsContainer(): Promise<void> {
  try {
    await vscode.commands.executeCommand(BESKID_VIEWS_CONTAINER);
  } catch {
    // container may already be visible
  }
}

/** Focus a registered `WebviewView` after opening the Beskid sidebar container. */
export async function focusBeskidWebviewView(viewType: string): Promise<void> {
  await openBeskidViewsContainer();
  try {
    await vscode.commands.executeCommand(`${viewType}.focus`);
  } catch {
    // view focus is registered once the sidebar webview has been opened at least once
  }
}
