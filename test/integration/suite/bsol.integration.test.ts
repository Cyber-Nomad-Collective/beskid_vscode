import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "beskid.beskid-vscode";
const LSP_CONFIG = "beskid.lsp";

async function replaceDocument(
	document: vscode.TextDocument,
	text: string,
): Promise<void> {
	const edit = new vscode.WorkspaceEdit();
	const end = document.positionAt(document.getText().length);
	edit.replace(document.uri, new vscode.Range(new vscode.Position(0, 0), end), text);
	assert.equal(await vscode.workspace.applyEdit(edit), true);
}

async function waitFor<T>(
	description: string,
	probe: () => T | undefined,
): Promise<T> {
	const deadline = Date.now() + 10_000;
	while (Date.now() < deadline) {
		const value = probe();
		if (value !== undefined) {
			return value;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error(`timed out waiting for ${description}`);
}

suite("Standalone BSOL IntelliSense", () => {
	let document: vscode.TextDocument;

	suiteSetup(async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `${EXTENSION_ID} not found`);
		assert.ok(
			vscode.workspace.getConfiguration(LSP_CONFIG).get<string>("server.path"),
			"isolated test profile must configure the exact integration LSP before activation",
		);
		if (!extension.isActive) {
			await extension.activate();
		}

		const fixture = vscode.Uri.joinPath(
			extension.extensionUri,
			"test",
			"fixtures",
			"workspace",
			"schema.bsol",
		);
		document = await vscode.workspace.openTextDocument(fixture);
		assert.equal(document.languageId, "bsol");
	});

	test("completion and hover survive an incremental edit", async () => {
		await replaceDocument(document, 'schema "config" {\n  payload \n}\n');
		const triggerEdit = new vscode.WorkspaceEdit();
		triggerEdit.insert(document.uri, new vscode.Position(1, 10), "@");
		assert.equal(await vscode.workspace.applyEdit(triggerEdit), true);
		const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
			"vscode.executeCompletionItemProvider",
			document.uri,
			new vscode.Position(1, 11),
			"@",
		);
		assert.ok(
			completions.items.some((item) => item.label === "@schemaless"),
			"missing @schemaless completion",
		);

		const edit = new vscode.WorkspaceEdit();
		edit.insert(document.uri, new vscode.Position(1, 11), "schemaless { raw }");
		assert.equal(await vscode.workspace.applyEdit(edit), true);
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
			"vscode.executeHoverProvider",
			document.uri,
			new vscode.Position(1, 12),
		);
		assert.ok(
			hovers.some((hover) =>
				hover.contents.some((content) =>
					(typeof content === "string" ? content : content.value).includes("raw text"),
				),
			),
			"missing @schemaless hover",
		);
	});

	test("diagnostics and semantic tokens come from the shared native LSP", async () => {
		await replaceDocument(document, 'schema "config" {\n  enabled =\n}\n');
		await waitFor("BSOL syntax diagnostics", () => {
			const diagnostics = vscode.languages.getDiagnostics(document.uri);
			return diagnostics.length > 0 ? diagnostics : undefined;
		}).then((diagnostics) => {
			assert.ok(
				diagnostics.every((diagnostic) => diagnostic.source === "beskid"),
				"BSOL diagnostics must be published by the native Beskid LSP",
			);
		});

		await replaceDocument(document, 'schema "config" {\n  enabled = true\n}\n');
		await waitFor("cleared BSOL diagnostics", () =>
			vscode.languages.getDiagnostics(document.uri).length === 0 ? true : undefined,
		);
		const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
			"vscode.provideDocumentSemanticTokens",
			document.uri,
		);
		const legend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
			"vscode.provideDocumentSemanticTokensLegend",
			document.uri,
		);
		assert.ok(tokens.data.length > 0, "missing BSOL semantic tokens");
		assert.equal(tokens.data.length % 5, 0, "semantic token stream is malformed");
		let line = 0;
		let start = 0;
		const decoded = Array.from({ length: tokens.data.length / 5 }, (_, index) => {
			const offset = index * 5;
			const deltaLine = tokens.data[offset];
			line += deltaLine;
			start = deltaLine === 0 ? start + tokens.data[offset + 1] : tokens.data[offset + 1];
			const length = tokens.data[offset + 2];
			return {
				text: document.getText(
					new vscode.Range(line, start, line, start + length),
				),
				type: legend.tokenTypes[tokens.data[offset + 3]],
			};
		});
		assert.deepEqual(
			decoded,
			[
				{ text: "schema", type: "namespace" },
				{ text: "enabled", type: "property" },
			],
			"BSOL block kinds and assignment keys must retain their shared semantic classifications",
		);
	});
});
