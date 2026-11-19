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

test("highlights automatic and derived property declarations in a mixed type", () => {
	const source = [
		"type Counter {",
		"  i64 raw;",
		"  prop i64 Count = 0;",
		"  i64 ReadRaw() { return this.raw; }",
		"  i64 Double => Count + Count;",
		"}",
	].join("\n");
	expect(scopesFor(source, "prop")).toContain("storage.modifier.beskid");
	expect(scopesFor(source, "Count")).toContain("variable.other.property.beskid");
	expect(scopesFor(source, "Double")).toContain("variable.other.property.beskid");
	expect(scopesFor(source, "=>")).toContain("keyword.operator.beskid");
	expect(allTokens("i64 prop = 0;").some((token) => token.scopes.includes("storage.modifier.beskid"))).toBe(false);
});

test("highlights property accessors and their contextual names", () => {
	const source = [
		"type Counter {",
		"  i64 Count",
		"  {",
		"    get;",
		"    set",
		"    {",
		"      if value < 0 { field = 0; }",
		"      else { field = value < 0 ? 0 : value; }",
		"    }",
		"  } = 0;",
		"  i64 Other { get { return field; } set; }",
		"}",
	].join("\n");
	for (const name of ["Count", "Other"]) {
		expect(scopesFor(source, name)).toContain("variable.other.property.beskid");
	}
	for (const name of ["get", "set"]) {
		expect(scopesFor(source, name)).toContain("keyword.declaration.accessor.beskid");
	}
	for (const name of ["field", "value"]) {
		expect(scopesFor(source, name)).toContain("variable.language.accessor.beskid");
	}
});

test("leaves accessor words ordinary outside the corresponding context", () => {
	for (const line of [
		"i64 get = 0; i64 set = get; i64 field = set; i64 value = field;",
		"obj.get(); obj.set(value); obj.field = obj.value;",
		"i64 Count { get { return value; } set { this.field = this.value; } }",
	]) {
		const tokens = allTokens(line);
		expect(tokens.some((token) => token.scopes.includes("variable.language.accessor.beskid"))).toBe(false);
		if (!line.includes("Count")) {
			expect(tokens.some((token) => token.scopes.includes("keyword.declaration.accessor.beskid"))).toBe(false);
		}
	}
	expect(allTokens("i64 value").some((token) => token.scopes.includes("variable.other.property.beskid"))).toBe(false);
});

test("keeps the accessor context across comments between tokens", () => {
	const source = "i64 Count { /* stored */ set /* normalize */ { field = value; } get; } = 0;";
	expect(scopesFor(source, "Count")).toContain("variable.other.property.beskid");
	expect(scopesFor(source, "set")).toContain("keyword.declaration.accessor.beskid");
	expect(scopesFor(source, "field")).toContain("variable.language.accessor.beskid");
	expect(scopesFor(source, "value")).toContain("variable.language.accessor.beskid");
});

test("highlights observe and contextual always property modifiers", () => {
	expect(scopesFor("observe counter.Count (old, new) => { };", "observe")).toContain("keyword.other.beskid");
	for (const declaration of ["always prop i32 Count = 0;", "always i32 Count { get; set; } = 0;"]) {
		expect(scopesFor(declaration, "always")).toContain("storage.modifier.beskid");
		expect(scopesFor(declaration, "Count")).toContain("variable.other.property.beskid");
	}
	expect(allTokens("i32 observeCount = 0;").some((token) => token.scopes.includes("keyword.other.beskid"))).toBe(false);
	expect(allTokens("i32 always = 0;").some((token) => token.scopes.includes("storage.modifier.beskid"))).toBe(false);
});

describe("Beskid TextMate grammar", () => {
	test("numeric literals with the _word and sized suffixes and float exponents are one number", () => {
		const line = "word w = 8_word; u8 b = 0xff_u8; i64 n = 1_000_i64; f64 e = 1.5e-3_f64;";
		for (const text of ["8_word", "0xff_u8", "1_000_i64", "1.5e-3_f64"]) {
			const token = allTokens(line).find((t) => t.text === text);
			expect(token?.scopes).toContain("constant.numeric.beskid");
		}
	});

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

	test("the conditional and try question marks are operators", () => {
		expect(scopesFor("i32 a = c ? 1 : 2;", "?")).toContain("keyword.operator.beskid");
		expect(scopesFor("i32 a = x? - 1;", "?")).toContain("keyword.operator.beskid");
	});
});
