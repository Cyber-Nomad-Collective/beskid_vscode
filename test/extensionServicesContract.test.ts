import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function constructorBody(source: string): string {
	const constructorStart = source.indexOf(
		"constructor(private readonly context: ExtensionContext)",
	);
	expect(constructorStart).toBeGreaterThanOrEqual(0);

	const openBrace = source.indexOf("{", constructorStart);
	expect(openBrace).toBeGreaterThanOrEqual(0);

	let depth = 0;
	for (let i = openBrace; i < source.length; i++) {
		const char = source[i];
		if (char === "{") {
			depth++;
			continue;
		}
		if (char === "}") {
			depth--;
			if (depth === 0) {
				return source.slice(openBrace + 1, i);
			}
		}
	}

	throw new Error("could not extract ExtensionServices constructor body");
}

describe("ExtensionServices activation contract", () => {
	const source = readFileSync(
		join(import.meta.dir, "../src/core/ExtensionServices.ts"),
		"utf8",
	);

	test("registerCoreCommands precedes registerViews in constructor", () => {
		const body = constructorBody(source);
		const coreIndex = body.indexOf("registerCoreCommands(");
		const viewsIndex = body.indexOf("registerViews(");

		expect(coreIndex).toBeGreaterThanOrEqual(0);
		expect(viewsIndex).toBeGreaterThanOrEqual(0);
		expect(coreIndex).toBeLessThan(viewsIndex);
	});

	test("registerCoreCommands is synchronous in constructor, not activate", () => {
		const activateStart = source.indexOf("async activate(): Promise<void>");
		expect(activateStart).toBeGreaterThanOrEqual(0);

		const coreIndex = source.indexOf("registerCoreCommands(");
		const viewsIndex = source.indexOf("registerViews(");

		expect(coreIndex).toBeLessThan(activateStart);
		expect(viewsIndex).toBeLessThan(activateStart);
	});

	test("status bar opens status dashboard command, not an editor tab", () => {
		expect(source).toContain('this.statusBar.command = "beskid.modal.open"');
		expect(source).toContain("void this.runtimeUi.modal.open()");
		expect(source).not.toContain("createWebviewPanel");
	});
});
