import { describe, expect, test } from "bun:test";
import { fromLspCommandResult } from "../src/lsp/lspBoundary.js";
import { LspCommandError } from "../src/lsp/lspExecuteCommand.js";
import { LspProjectApi } from "../src/workspace/lspProjectApi.js";

describe("LspProjectApi outcomes", () => {
	test("listWorkspaces surfaces execute-command failures", async () => {
		const api = new LspProjectApi(() => undefined);
		const outcome = await api.listWorkspaces();
		expect(outcome.workspaces).toEqual([]);
		expect(outcome.error).toContain("beskid.listWorkspaces");
	});

	test("getGraph returns structured error messages", async () => {
		const api = new LspProjectApi(() => undefined);
		const outcome = await api.getGraph("file:///tmp/demo.bproj");
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) {
			expect(outcome.error).toContain("beskid.getGraph");
		}
	});

	test("fromLspCommandResult maps command errors to strings", () => {
		const error = new LspCommandError("beskid.getProjectDependencies", "offline");
		const outcome = fromLspCommandResult({ ok: false, error });
		expect(outcome).toEqual({
			ok: false,
			error: "executeCommand beskid.getProjectDependencies failed: offline",
		});
	});
});
