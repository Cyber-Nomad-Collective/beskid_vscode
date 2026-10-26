import * as vscode from "vscode";
import {
	parseFailedTests,
	type TestDiagnostic,
	testDiagnostics,
} from "./testFailures.js";

let collection: vscode.DiagnosticCollection | undefined;

function diagnostics(): vscode.DiagnosticCollection {
	collection ??= vscode.languages.createDiagnosticCollection("beskid-test");
	return collection;
}

export function registerTestDiagnostics(context: vscode.ExtensionContext): void {
	context.subscriptions.push(diagnostics());
}

/** Test diagnostics last until the next run. */
export function clearTestDiagnostics(): void {
	diagnostics().clear();
}

/** Replaces the test diagnostics with those in `stdout` of `beskid test --json`; returns them. */
export function publishTestDiagnostics(
	stdout: string,
	baseDir: string,
): TestDiagnostic[] {
	const collection = diagnostics();
	collection.clear();
	const failed = parseFailedTests(stdout);
	if (failed.length === 0) {
		return [];
	}
	const found = testDiagnostics(failed, baseDir);
	const byFile = new Map<string, vscode.Diagnostic[]>();
	for (const item of found) {
		const position = new vscode.Position(
			Math.max(0, item.line - 1),
			Math.max(0, item.column - 1),
		);
		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(position, position.translate(0, 1)),
			item.message,
			vscode.DiagnosticSeverity.Error,
		);
		diagnostic.source = "beskid test";
		byFile.set(item.file, [...(byFile.get(item.file) ?? []), diagnostic]);
	}
	for (const [file, list] of byFile) {
		collection.set(vscode.Uri.file(file), list);
	}
	return found;
}
