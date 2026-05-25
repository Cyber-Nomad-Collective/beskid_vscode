import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { BeskidDashboardProvider } from "../dashboard/BeskidDashboardProvider.js";
import { BeskidDebugTreeProvider } from "../debug/BeskidDebugTreeProvider.js";
import type { LspRuntimeState } from "../runtime/LspRuntimeState.js";

export type RuntimeUiHandles = {
  dashboard: BeskidDashboardProvider;
  debugProvider: BeskidDebugTreeProvider;
};

export function registerRuntimeUi(
  context: ExtensionContext,
  runtime: LspRuntimeState,
  extensionVersion: string,
): RuntimeUiHandles {
  const dashboard = new BeskidDashboardProvider(runtime, extensionVersion);
  const debugProvider = new BeskidDebugTreeProvider(runtime);

  context.subscriptions.push(
    runtime.onDidChange(() => dashboard.refresh()),
    vscode.window.registerWebviewViewProvider(BeskidDashboardProvider.viewType, dashboard, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider("beskidDebugView", debugProvider),
    vscode.commands.registerCommand("beskid.dashboard.focus", () => dashboard.focus()),
  );

  return { dashboard, debugProvider };
}
