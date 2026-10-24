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
		"../syntaxes/beskid.tmLanguage.json",
	);
	const registry = new Registry({
		onigLib: Promise.resolve({
			createOnigScanner: (patterns) => new OnigScanner(patterns),
			createOnigString: (text) => new OnigString(text),
		}),
		loadGrammar: async (scopeName) =>
			scopeName === "source.beskid"
				? parseRawGrammar(readFileSync(grammarPath, "utf8"), grammarPath)
				: null,
	});
	grammar = (await registry.loadGrammar("source.beskid")) as IGrammar;
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

function allTokens(line: string): { text: string; scopes: string[] }[] {
	return grammar
		.tokenizeLine(line, INITIAL)
		.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes }));
}

describe("Beskid TextMate grammar", () => {
	test("string escapes n t r 0 u{...} and the quote, backslash and interpolation escapes", () => {
		const line = String.raw`string s = "\n\t\r\0\u{1F600}\"\\\${";`;
		const escapes = allTokens(line)
			.filter((t) => t.scopes.includes("constant.character.escape.beskid"))
			.map((t) => t.text);
		expect(escapes).toEqual(["\\n", "\\t", "\\r", "\\0", "\\u{1F600}", '\\"', "\\\\", "\\${"]);
	});

	test("escaped dollar-brace does not open an interpolation", () => {
		const tokens = allTokens(String.raw`"a\${b}"`);
		expect(tokens.some((t) => t.scopes.includes("constant.other.interpolation.beskid"))).toBe(false);
	});

	test("character literals with escapes", () => {
		const line = String.raw`char a = 'x'; char b = '\n'; char c = '\u{41}'; char d = '\'';`;
		const tokens = allTokens(line);
		expect(tokens.filter((t) => t.scopes.includes("string.quoted.single.beskid")).length).toBeGreaterThan(0);
		const escapes = tokens
			.filter((t) => t.scopes.includes("constant.character.escape.beskid"))
			.map((t) => t.text);
		expect(escapes).toEqual(["\\n", "\\u{41}", "\\'"]);
	});

	test("compound assignment operators are one operator token", () => {
		for (const op of ["+=", "-=", "*=", "/=", "%="]) {
			expect(scopesFor(`n ${op} 2;`, op)).toContain("keyword.operator.beskid");
		}
	});
});
