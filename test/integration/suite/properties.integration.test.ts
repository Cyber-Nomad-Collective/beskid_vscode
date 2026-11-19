import * as assert from "node:assert/strict";
import * as vscode from "vscode";

suite("Beskid properties", () => {
	test("supports accessor blocks, backing storage navigation, completion, and read-only diagnostics", async () => {
		const extension = vscode.extensions.getExtension("beskid.beskid-vscode");
		assert.ok(extension);
		await extension.activate();

		const uri = vscode.Uri.joinPath(
			extension.extensionUri, "test", "fixtures", "workspace", "Properties", "Src", "Main.bd",
		);
		const document = await vscode.workspace.openTextDocument(uri);
		assert.equal(document.languageId, "beskid");
		await vscode.window.showTextDocument(document);

		const source = document.getText();
		for (const [reference, prefix, name, declaration] of [
			["counter.Count", "counter.", "Count", "i64 Count {"],
			["counter.Double", "counter.", "Double", "i64 Double =>"],
			["counter.Limit", "counter.", "Limit", "i64 Limit {"],
			["field = value", "", "Count", "i64 Count {"],
		] as const) {
			const position = document.positionAt(source.indexOf(reference) + prefix.length);
			const expectedStart = document.positionAt(source.indexOf(declaration) + "i64 ".length);
			await waitFor(`definition of ${name}`, async () => {
				const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
					"vscode.executeDefinitionProvider", uri, position,
				);
				return locations?.some((location) => {
					const target = "targetUri" in location ? location.targetUri : location.uri;
					const range = "targetUri" in location ? location.targetSelectionRange : location.range;
					return target.toString() === uri.toString()
						&& range?.start.isEqual(expectedStart)
						&& document.getText(range) === name;
				});
			});
			const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", uri, position);
			assert.ok(hovers.some((hover) => hover.contents.some((content) =>
				(typeof content === "string" ? content : content.value).includes(`**property** \`${name}\``),
			)), `expected property hover for ${name}`);
			if (prefix === "") {
				assert.ok(hovers.some((hover) => hover.contents.some((content) =>
					(typeof content === "string" ? content : content.value).includes("backing storage"),
				)), "field hover should describe access to the backing storage");
			}
		}

		for (const [name, occurrence] of [
			["field", "field = value"],
			["value", "value < 0"],
			["counter", "counter.Count != 0"],
		] as const) {
			const position = document.positionAt(source.indexOf(occurrence) + 1);
			await waitFor(`lexical completion for ${name}`, async () => {
				const completion = await vscode.commands.executeCommand<vscode.CompletionList>(
					"vscode.executeCompletionItemProvider", uri, position,
				);
				return completion?.items.some((item) =>
					item.label === name && item.kind === vscode.CompletionItemKind.Variable && item.insertText === name
				);
			});
		}

		const writeStart = document.positionAt(source.indexOf("    counter.Count = 3;"));
		for (const name of ["Double", "Limit"]) {
			const insert = new vscode.WorkspaceEdit();
			insert.insert(uri, writeStart, `    counter.${name} = 4;\n`);
			assert.equal(await vscode.workspace.applyEdit(insert), true);
			try {
				await waitFor(`read-only write diagnostic on ${name}`, () =>
					vscode.languages.getDiagnostics(uri).some((diagnostic) => {
						const code = typeof diagnostic.code === "object" ? diagnostic.code.value : diagnostic.code;
						return code === "E1260"
							&& diagnostic.source === "beskid"
							&& diagnostic.message.includes(`property \`${name}\` is read-only`)
							&& diagnostic.range.start.line === writeStart.line
							&& document.getText(diagnostic.range) === name;
					}),
				);
			} finally {
				const repair = new vscode.WorkspaceEdit();
				repair.delete(uri, new vscode.Range(writeStart, writeStart.translate(1)));
				assert.equal(await vscode.workspace.applyEdit(repair), true);
			}
			await waitFor("cleared diagnostics after repair", () => vscode.languages.getDiagnostics(uri).length === 0);
		}

		const memberLine = document.lineAt(document.positionAt(source.indexOf("    if counter.Double")).line);
		const incomplete = "    counter.";
		const memberEdit = new vscode.WorkspaceEdit();
		memberEdit.replace(uri, memberLine.range, incomplete);
		assert.equal(await vscode.workspace.applyEdit(memberEdit), true);
		try {
			const position = new vscode.Position(memberLine.lineNumber, incomplete.length);
			await waitFor("property completion after counter.", async () => {
				const completion = await vscode.commands.executeCommand<vscode.CompletionList>(
					"vscode.executeCompletionItemProvider", uri, position, ".",
				);
				if (!completion || completion.items.some((item) =>
					(typeof item.label === "string" ? item.label : item.label.label).startsWith("$property_")
				)) return false;
				return [
					["Count", vscode.CompletionItemKind.Property],
					["Double", vscode.CompletionItemKind.Property],
					["Limit", vscode.CompletionItemKind.Property],
					["ReadRaw", vscode.CompletionItemKind.Method],
					["raw", vscode.CompletionItemKind.Field],
				].every(([name, kind]) => {
					const matches = completion.items.filter((item) => item.label === name);
					return matches.length === 1 && matches[0].kind === kind
						&& matches[0].insertText === name;
				});
			});
		} finally {
			const restore = new vscode.WorkspaceEdit();
			restore.replace(uri, document.lineAt(memberLine.lineNumber).range, memberLine.text);
			assert.equal(await vscode.workspace.applyEdit(restore), true);
		}

		const invalidCall = memberLine.text.replace("counter.Double", "counter.Double()");
		const callEdit = new vscode.WorkspaceEdit();
		callEdit.replace(uri, document.lineAt(memberLine.lineNumber).range, invalidCall);
		assert.equal(await vscode.workspace.applyEdit(callEdit), true);
		try {
			const offset = invalidCall.indexOf("Double(") + "Double(".length;
			const position = new vscode.Position(memberLine.lineNumber, offset);
			const signature = await vscode.commands.executeCommand<vscode.SignatureHelp | undefined>(
				"vscode.executeSignatureHelpProvider", uri, position, "(",
			);
			assert.ok(!signature?.signatures.length, "a derived property must not show a method signature");
		} finally {
			const restore = new vscode.WorkspaceEdit();
			restore.replace(uri, document.lineAt(memberLine.lineNumber).range, memberLine.text);
			assert.equal(await vscode.workspace.applyEdit(restore), true);
		}
	});

	test("specializes generic properties while navigating to their shared declaration", async () => {
		const extension = vscode.extensions.getExtension("beskid.beskid-vscode");
		assert.ok(extension);
		await extension.activate();

		const uri = vscode.Uri.joinPath(
			extension.extensionUri, "test", "fixtures", "workspace", "GenericProperties", "Src", "Main.bd",
		);
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document);
		const source = document.getText();
		const valueDeclaration = document.positionAt(source.indexOf("T Value {") + "T ".length);

		for (const [reference, prefix, ty] of [
			["numbers.Value =", "numbers.", "i64"],
			["words.Value =", "words.", "string"],
			["numbers.Value ==", "numbers.", "i64"],
			["words.Value ==", "words.", "string"],
			["records.Value =", "records.", "Main::Item"],
			["item = records.Value", "item = records.", "Main::Item"],
			["runners.Value =", "runners.", "Main::Runner"],
			["selected = runners.Value", "selected = runners.", "Main::Runner"],
			["field = value", "", "T"],
		] as const) {
			const position = document.positionAt(source.indexOf(reference) + prefix.length);
			await waitFor(`generic property definition at ${reference}`, async () => {
				const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
					"vscode.executeDefinitionProvider", uri, position,
				);
				return locations?.some((location) => {
					const target = "targetUri" in location ? location.targetUri : location.uri;
					const range = "targetUri" in location ? location.targetSelectionRange : location.range;
					return target.toString() === uri.toString()
						&& range?.start.isEqual(valueDeclaration)
						&& document.getText(range) === "Value";
				});
			});
			const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", uri, position);
			const hoveredName = prefix ? "Value" : "field";
			assert.ok(hovers.some((hover) =>
				hover.range?.start.isEqual(position) &&
				document.getText(hover.range) === hoveredName &&
				hover.contents.some((content) => {
					const markdown = typeof content === "string" ? content : content.value;
					return markdown.includes("**property** `Value`") && markdown.includes(`Type \`${ty}\``);
				}),
			), `expected property hover with ${ty} at ${reference}`);
		}

		const memberLine = document.lineAt(document.positionAt(source.indexOf("    numbers.Value =")).line);
		const incomplete = "    numbers.";
		const edit = new vscode.WorkspaceEdit();
		edit.replace(uri, memberLine.range, incomplete);
		assert.equal(await vscode.workspace.applyEdit(edit), true);
		try {
			const position = new vscode.Position(memberLine.lineNumber, incomplete.length);
			await waitFor("generic property completion after numbers.", async () => {
				const completion = await vscode.commands.executeCommand<vscode.CompletionList>(
					"vscode.executeCompletionItemProvider", uri, position, ".",
				);
				const values = completion?.items.filter((item) => item.label === "Value");
				return values?.length === 1 && values[0].kind === vscode.CompletionItemKind.Property
					&& !completion?.items.some((item) =>
						(typeof item.label === "string" ? item.label : item.label.label).startsWith("$property_")
					);
			});
		} finally {
			const restore = new vscode.WorkspaceEdit();
			restore.replace(uri, document.lineAt(memberLine.lineNumber).range, memberLine.text);
			assert.equal(await vscode.workspace.applyEdit(restore), true);
		}
		for (const [validWrite, invalidWrite, expectedType, actualType] of [
			["    numbers.Value = 42;", "    numbers.Value = true;", "i64", "bool"],
			["    runners.Value = update;", "    runners.Value = Item { number: 7 };", "Runner", "Item"],
		] as const) {
			const line = document.lineAt(document.positionAt(source.indexOf(validWrite)).line);
			const badWrite = new vscode.WorkspaceEdit();
			badWrite.replace(uri, line.range, invalidWrite);
			assert.equal(await vscode.workspace.applyEdit(badWrite), true);
			try {
				await waitFor(`type mismatch on the ${expectedType} setter input`, () =>
					vscode.languages.getDiagnostics(uri).some((diagnostic) => {
						const code = typeof diagnostic.code === "object" ? diagnostic.code.value : diagnostic.code;
						return code === "E1206" && diagnostic.range.start.line === line.lineNumber
							&& diagnostic.message.includes(`expected \`${expectedType}\`, got \`${actualType}\``);
					}),
				);
			} finally {
				const restore = new vscode.WorkspaceEdit();
				restore.replace(uri, document.lineAt(line.lineNumber).range, line.text);
				assert.equal(await vscode.workspace.applyEdit(restore), true);
			}
			await waitFor(`no diagnostics after repairing the ${expectedType} setter input`, () =>
				vscode.languages.getDiagnostics(uri).length === 0,
			);
		}
	});
});

async function waitFor(label: string, probe: () => boolean | undefined | Promise<boolean | undefined>): Promise<void> {
	const deadline = Date.now() + 15_000;
	while (Date.now() < deadline) {
		if (await probe()) return;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error(`timed out waiting for ${label}`);
}
