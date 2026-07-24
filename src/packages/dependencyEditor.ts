import { readFileSync, writeFileSync } from "node:fs";
import * as vscode from "vscode";

export type AddDependencyInput = {
	name: string;
	version?: string;
	source?: "registry" | "path";
	path?: string;
};

function buildDependencyBlock(input: AddDependencyInput): string {
	const name = input.name.trim();
	if (input.source === "path" && input.path?.trim()) {
		return `\ndependency "${name}" {\n  source = path\n  path = "${input.path.trim()}"\n}\n`;
	}
	const version = input.version?.trim();
	if (version) {
		return `\ndependency "${name}" {\n  source = registry\n  version = "${version}"\n}\n`;
	}
	return `\ndependency "${name}" {\n  source = registry\n}\n`;
}

/** Append a dependency block to a `.bproj` manifest (before first `target` or at EOF). */
export function appendDependencyToProjectManifest(
	manifestPath: string,
	input: AddDependencyInput,
): void {
	const text = readFileSync(manifestPath, "utf8");
	if (
		new RegExp(
			`dependency\\s+"${input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
			"i",
		).test(text)
	) {
		throw new Error(
			`Dependency "${input.name}" already exists in project manifest.`,
		);
	}
	const block = buildDependencyBlock(input);
	const targetIdx = text.search(/\ntarget\s+"/);
	const next =
		targetIdx >= 0
			? `${text.slice(0, targetIdx)}${block}${text.slice(targetIdx)}`
			: `${text.trimEnd()}\n${block}`;
	writeFileSync(manifestPath, next, "utf8");
}

/** @deprecated Use {@link appendDependencyToProjectManifest}. */
export const appendDependencyToProjectProj = appendDependencyToProjectManifest;

export async function promptAndAddDependency(
	projectUri: vscode.Uri,
): Promise<boolean> {
	const name = await vscode.window.showInputBox({ prompt: "Package name" });
	if (!name?.trim()) {
		return false;
	}
	const version = await vscode.window.showInputBox({
		prompt: "Version (registry)",
		placeHolder: "e.g. 1.0.0 — leave empty if unspecified",
	});
	try {
		appendDependencyToProjectManifest(projectUri.fsPath, {
			name: name.trim(),
			version: version?.trim() || undefined,
			source: "registry",
		});
		void vscode.window.showInformationMessage(
			`Added dependency "${name.trim()}" to project manifest.`,
		);
		return true;
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		void vscode.window.showErrorMessage(msg);
		return false;
	}
}
