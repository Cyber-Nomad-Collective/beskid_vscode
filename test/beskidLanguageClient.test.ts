import { beforeAll, describe, expect, mock, test } from "bun:test";
import { completeVscodeMock } from "./fixtures/vscodeMock.js";

mock.module("vscode", () => completeVscodeMock());
mock.module("vscode-languageclient/node", () => ({
	LanguageClient: class LanguageClient {},
}));

let buildBeskidClientOptions: typeof import("../src/lsp/beskidLanguageClient.js").buildBeskidClientOptions;

beforeAll(async () => {
	({ buildBeskidClientOptions } = await import(
		"../src/lsp/beskidLanguageClient.js"
	));
});

describe("Beskid language client document coverage", () => {
	test("routes standalone BSOL documents through the shared native LSP", () => {
		const selectedProjectUri = {
			toString: () => "file:///workspace/project.bproj",
		};
		const options = buildBeskidClientOptions(
			{} as never,
			selectedProjectUri as never,
		);
		expect(options.documentSelector).toContainEqual({
			scheme: "file",
			language: "bsol",
			pattern: "**/*.bsol",
		});
		expect(options.synchronize?.configurationSection).toEqual([
			"beskid.lsp",
			"beskid",
		]);
		expect(options.initializationOptions).toEqual(
			expect.objectContaining({
				focusedProjectUri: "file:///workspace/project.bproj",
				selectedProjectUri: "file:///workspace/project.bproj",
			}),
		);
	});
});
