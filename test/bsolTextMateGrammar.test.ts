import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OnigScanner, OnigString, loadWASM } from "vscode-oniguruma";
import {
	INITIAL,
	Registry,
	parseRawGrammar,
	type IGrammar,
} from "vscode-textmate";

let grammar: IGrammar;

beforeAll(async () => {
	const wasm = readFileSync(
		join(import.meta.dir, "../node_modules/vscode-oniguruma/release/onig.wasm"),
	);
	await loadWASM(
		wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
	);
	const grammarPath = join(
		import.meta.dir,
		"../syntaxes/beskid-proj.tmLanguage.json",
	);
	const registry = new Registry({
		onigLib: Promise.resolve({
			createOnigScanner: (patterns) => new OnigScanner(patterns),
			createOnigString: (text) => new OnigString(text),
		}),
		loadGrammar: async (scopeName) =>
			scopeName === "source.beskid.proj"
				? parseRawGrammar(readFileSync(grammarPath, "utf8"), grammarPath)
				: null,
	});
	grammar = (await registry.loadGrammar("source.beskid.proj")) as IGrammar;
});

function scopesFor(source: string, tokenText: string): string[] {
	let stack = INITIAL;
	for (const line of source.split("\n")) {
		const result = grammar.tokenizeLine(line, stack);
		stack = result.ruleStack;
		for (const token of result.tokens) {
			if (line.slice(token.startIndex, token.endIndex) === tokenText) {
				return token.scopes;
			}
		}
	}
	throw new Error(`token ${JSON.stringify(tokenText)} was not emitted`);
}

describe("shared BSOL TextMate syntax adapter", () => {
	test("classifies generic block kinds, keys, values, and attributes", () => {
		const source = [
			'custom_schema "config" {',
			"  enabled = true",
			"  retries = 3",
			"  payload @schemaless { raw }",
			"}",
		].join("\n");

		expect(scopesFor(source, "custom_schema")).toContain(
			"keyword.control.bsol",
		);
		expect(scopesFor(source, "enabled")).toContain(
			"variable.other.property.bsol",
		);
		expect(scopesFor(source, "true")).toContain(
			"constant.language.boolean.bsol",
		);
		expect(scopesFor(source, "3")).toContain("constant.numeric.bsol");
		expect(scopesFor(source, "@schemaless")).toContain(
			"storage.modifier.bsol",
		);
	});

	test("covers canonical references, type constructors, and line comments", () => {
		const source = [
			"@sealed",
			"custom_schema {",
			"  shape = map[string, ref(Item)]",
			"  owner = @core/defaults",
			"  # parser-backed configuration",
			"}",
		].join("\n");

		expect(scopesFor(source, "@sealed")).toContain(
			"variable.other.reference.bsol",
		);
		expect(scopesFor(source, "map")).toContain("storage.type.bsol");
		expect(scopesFor(source, "ref")).toContain("storage.type.bsol");
		expect(scopesFor(source, "@core/defaults")).toContain(
			"variable.other.reference.bsol",
		);
		expect(scopesFor(source, "# parser-backed configuration")).toContain(
			"comment.line.number-sign.bsol",
		);
	});
});
