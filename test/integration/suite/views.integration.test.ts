import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "beskid.beskid-vscode";

const BESKID_TREE_VIEW_IDS = [
  "beskidDebugView",
  "beskidWorkspaceView",
  "beskidProjectView",
  "beskidProjectOutlineView",
  "beskidPackagesView",
] as const;

const BESKID_WEBVIEW_VIEW_IDS = ["beskidDashboardView"] as const;

suite("Beskid extension activation", () => {
  test("extension is installed and active", async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} not found`);
    if (!extension.isActive) {
      await extension.activate();
    }
    assert.ok(extension.isActive);
  });
});

suite("Beskid sidebar views", () => {
  test("tree views expose focus commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const viewId of BESKID_TREE_VIEW_IDS) {
      assert.ok(
        commands.includes(`${viewId}.focus`),
        `missing focus command for ${viewId}`,
      );
      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand(`${viewId}.focus`);
      }, `focus command failed for ${viewId}`);
    }
  });

  test("webview dashboard exposes focus command", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const viewId of BESKID_WEBVIEW_VIEW_IDS) {
      assert.ok(
        commands.includes(`${viewId}.focus`),
        `missing focus command for ${viewId}`,
      );
      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand(`${viewId}.focus`);
      }, `focus command failed for ${viewId}`);
    }
  });
});

suite("Beskid commands", () => {
  test("registers dashboard, debug, and quick action commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      "beskid.dashboard.focus",
      "beskid.debug.focus",
      "beskid.lsp.quickActions",
      "beskid.cli.bootstrap",
      "beskid.lsp.restart",
    ]) {
      assert.ok(commands.includes(command), `missing command ${command}`);
    }
  });
});
