import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "beskid.beskid-vscode";

const BESKID_TREE_VIEW_IDS = [
	"beskidProjectsView",
	"beskidPackagesView",
] as const;

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

	test("beskidProjectsView.focus is registered and executable", async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes("beskidProjectsView.focus"),
			"missing beskidProjectsView.focus",
		);
		await assert.doesNotReject(async () => {
			await vscode.commands.executeCommand("beskidProjectsView.focus");
		});
	});
});

suite("Beskid commands", () => {
	test("registers modal, packages, and quick action commands", async () => {
		const commands = await vscode.commands.getCommands(true);
		for (const command of [
			"beskid.modal.open",
			"beskid.dashboard.focus",
			"beskid.packages.open",
			"beskid.revealInProjectsTree",
			"beskid.lsp.quickActions",
			"beskid.cli.bootstrap",
			"beskid.lsp.restart",
			"beskid.openSymbolDocumentation",
		]) {
			assert.ok(commands.includes(command), `missing command ${command}`);
		}
	});

	test("registers beskid.focusProject after activation", async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `${EXTENSION_ID} not found`);
		if (!extension.isActive) {
			await extension.activate();
		}

		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes("beskid.focusProject"),
			"missing beskid.focusProject",
		);

		await assert.doesNotReject(async () => {
			await vscode.commands.executeCommand("beskid.focusProject");
		});
	});
});
