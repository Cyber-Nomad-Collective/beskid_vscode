import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { focusBeskidTreeView } from "../activation/focusBeskidViews.js";
import { BeskidDashboardProvider } from "../dashboard/BeskidDashboardProvider.js";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";

export type RuntimeUiHandles = {
  dashboard: BeskidDashboardProvider;
};

export function registerRuntimeUi(
  context: ExtensionContext,
  runtime: LspRuntimeState,
  extensionVersion: string,
): RuntimeUiHandles {
  const dashboard = new BeskidDashboardProvider(runtime, extensionVersion);

  context.subscriptions.push(
    runtime.onDidChange(() => dashboard.refresh()),
    vscode.window.registerWebviewViewProvider(BeskidDashboardProvider.viewType, dashboard, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("beskid.dashboard.focus", () => dashboard.focus()),
    vscode.commands.registerCommand("beskid.debug.focus", () => focusBeskidTreeView("beskidDebugView")),
  );

  return { dashboard };
}
