import { describe, expect, test } from "bun:test";
import {
	LspCommandError,
	unwrapLspResult,
} from "../src/lsp/lspExecuteCommand.js";

describe("LspCommandError", () => {
	test("includes command name and nested error message", () => {
		const error = new LspCommandError(
			"beskid.listWorkspaces",
			new Error("server offline"),
		);
		expect(error.command).toBe("beskid.listWorkspaces");
		expect(error.message).toContain("beskid.listWorkspaces");
		expect(error.message).toContain("server offline");
	});
});

describe("unwrapLspResult", () => {
	test("returns value for successful commands", () => {
		expect(unwrapLspResult({ ok: true, value: { workspaces: [] } })).toEqual({
			workspaces: [],
		});
	});

	test("returns undefined for failed commands", () => {
		const error = new LspCommandError("beskid.getGraph", "timeout");
		expect(unwrapLspResult({ ok: false, error })).toBeUndefined();
	});
});
