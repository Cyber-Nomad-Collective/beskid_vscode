import { describe, expect, test } from "bun:test";
import { buildExecuteCommandMiddleware } from "../src/lsp/clientHooks.js";

describe("buildExecuteCommandMiddleware", () => {
	test("passes through command result from next", async () => {
		const middleware = buildExecuteCommandMiddleware(undefined);
		const result = await middleware.executeCommand?.(
			"beskid.listWorkspaces",
			[],
			async () => ({ workspaces: [] }),
		);
		expect(result).toEqual({ workspaces: [] });
	});

	test("refreshWorkspace invokes onRefreshWorkspaceUi after server handler", async () => {
		let uiCalls = 0;
		let nextCalls = 0;
		const middleware = buildExecuteCommandMiddleware({
			onRefreshWorkspaceUi: async () => {
				uiCalls += 1;
			},
		});
		await middleware.executeCommand?.("beskid.refreshWorkspace", [], async () => {
			nextCalls += 1;
			return null;
		});
		expect(nextCalls).toBe(1);
		expect(uiCalls).toBe(1);
	});

	test("other commands do not trigger refresh UI hook", async () => {
		let uiCalls = 0;
		const middleware = buildExecuteCommandMiddleware({
			onRefreshWorkspaceUi: async () => {
				uiCalls += 1;
			},
		});
		await middleware.executeCommand?.(
			"beskid.getGraph",
			[{ projectUri: "file:///x" }],
			async () => null,
		);
		expect(uiCalls).toBe(0);
	});
});
