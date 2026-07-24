import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";
import type { LspRuntimeSnapshot } from "../src/runtime/lspRuntimeTypes.js";
import { testRuntimeSnapshot } from "./fixtures/lspRuntimeSnapshot.js";
import { completeVscodeMock } from "./fixtures/vscodeMock.js";

type MessageHandler = (message: unknown) => void;
type ChangeListener = (snapshot: LspRuntimeSnapshot) => void;

function createRuntimeMock(initial: Partial<LspRuntimeSnapshot> = {}) {
	let snapshot = testRuntimeSnapshot(initial);
	const listeners = new Set<ChangeListener>();
	return {
		getSnapshot: () => snapshot,
		setSnapshot: (next: Partial<LspRuntimeSnapshot>) => {
			snapshot = testRuntimeSnapshot({ ...snapshot, ...next });
			for (const listener of listeners) {
				listener(snapshot);
			}
		},
		onDidChange: (listener: ChangeListener) => {
			listeners.add(listener);
			return { dispose: () => listeners.delete(listener) };
		},
	};
}

function createMockVscode() {
	const subscriptions: unknown[] = [];
	const registeredProviders = new Map<string, unknown>();
	const registeredCommands = new Map<string, () => unknown | Promise<unknown>>();
	const executeCommand = mock(async (command: string) => command);

	let messageHandler: MessageHandler | undefined;
	let webviewHtml = "";
	let webviewOptions: unknown;
	let disposeHandler: (() => void) | undefined;

	const webview = {
		get options() {
			return webviewOptions;
		},
		set options(value: unknown) {
			webviewOptions = value;
		},
		get html() {
			return webviewHtml;
		},
		set html(value: string) {
			webviewHtml = value;
		},
		onDidReceiveMessage: mock((handler: MessageHandler) => {
			messageHandler = handler;
			return {
				dispose: () => {
					messageHandler = undefined;
				},
			};
		}),
	};

	const registerWebviewViewProvider = mock((id: string, provider: unknown) => {
		registeredProviders.set(id, provider);
		return { dispose: () => registeredProviders.delete(id) };
	});

	const registerCommand = mock(
		(id: string, handler: () => unknown | Promise<unknown>) => {
			registeredCommands.set(id, handler);
			return { dispose: () => registeredCommands.delete(id) };
		},
	);

	function createWebviewView() {
		webviewHtml = "";
		webviewOptions = undefined;
		disposeHandler = undefined;
		messageHandler = undefined;
		return {
			webview,
			onDidDispose: mock((handler: () => void) => {
				disposeHandler = handler;
				return {
					dispose: () => {
						disposeHandler = undefined;
					},
				};
			}),
			show: mock(() => undefined),
		};
	}

	class TreeItem {
		constructor(
			public label: string,
			public collapsibleState: number,
		) {}
	}

	return {
		subscriptions,
		registeredProviders,
		registeredCommands,
		executeCommand,
		registerWebviewViewProvider,
		registerCommand,
		get messageHandler() {
			return messageHandler;
		},
		get webviewHtml() {
			return webviewHtml;
		},
		get webviewOptions() {
			return webviewOptions;
		},
		createWebviewView,
		triggerDispose() {
			disposeHandler?.();
		},
		triggerMessage(message: unknown) {
			messageHandler?.(message);
		},
		module: completeVscodeMock({
			TreeItem,
			window: {
				registerWebviewViewProvider,
			},
			commands: {
				registerCommand,
				executeCommand,
			},
			workspace: {
				getConfiguration: () => ({
					get: (_key: string, defaultValue?: unknown) => defaultValue,
				}),
				workspaceFolders: [],
				asRelativePath: (uri: { fsPath?: string } | string) => String(uri),
				findFiles: async () => [],
			},
		}),
	};
}

let mockVscode = createMockVscode();

async function loadModalPanelModule() {
	mock.module("vscode", () => mockVscode.module);
	return import("../src/dashboard/BeskidModalPanel.js");
}

describe("BeskidModalPanel status dashboard", () => {
	beforeEach(() => {
		mockVscode = createMockVscode();
	});

	test("BESKID_DASHBOARD_VIEW_ID matches package.json panel webview", async () => {
		const { BESKID_DASHBOARD_VIEW_ID } = await loadModalPanelModule();
		const panelViews = pkg.contributes.views.beskidPanel as {
			id: string;
			type?: string;
		}[];
		expect(BESKID_DASHBOARD_VIEW_ID).toBe("beskidDashboardView");
		expect(panelViews).toEqual([
			expect.objectContaining({ id: BESKID_DASHBOARD_VIEW_ID, type: "webview" }),
		]);
	});

	test("register wires webview provider, commands, and runtime subscription", async () => {
		const { BeskidModalPanel } = await loadModalPanelModule();
		const { panel } = {
			panel: new BeskidModalPanel(createRuntimeMock() as never, "0.2.0"),
		};
		panel.register({ subscriptions: mockVscode.subscriptions } as never);

		expect(mockVscode.registerWebviewViewProvider).toHaveBeenCalledWith(
			"beskidDashboardView",
			panel,
		);
		expect(mockVscode.registerCommand).toHaveBeenCalledWith(
			"beskid.modal.open",
			expect.any(Function),
		);
		expect(mockVscode.registerCommand).toHaveBeenCalledWith(
			"beskid.dashboard.focus",
			expect.any(Function),
		);
		expect(mockVscode.subscriptions.length).toBeGreaterThanOrEqual(3);
	});

	test("registered modal commands focus the panel webview", async () => {
		const { BeskidModalPanel, BESKID_DASHBOARD_VIEW_ID } =
			await loadModalPanelModule();
		const panel = new BeskidModalPanel(createRuntimeMock() as never, "0.2.0");
		panel.register({ subscriptions: mockVscode.subscriptions } as never);
		panel.resolveWebviewView(
			mockVscode.createWebviewView() as never,
			{} as never,
			{} as never,
		);

		for (const commandId of ["beskid.modal.open", "beskid.dashboard.focus"]) {
			const handler = mockVscode.registeredCommands.get(commandId);
			expect(handler).toBeDefined();
			await handler?.();
		}

		expect(mockVscode.executeCommand).toHaveBeenCalledWith(
			`${BESKID_DASHBOARD_VIEW_ID}.focus`,
		);
	});

	test("resolveWebviewView enables scripts and renders initial dashboard HTML", async () => {
		const { BeskidModalPanel } = await loadModalPanelModule();
		const panel = new BeskidModalPanel(
			createRuntimeMock({
				phase: "running",
				cliVersion: "1.2.3",
				lspVersion: "4.5.6",
			}) as never,
			"0.2.0",
		);

		panel.resolveWebviewView(
			mockVscode.createWebviewView() as never,
			{} as never,
			{} as never,
		);

		expect(mockVscode.webviewOptions).toEqual({
			enableScripts: true,
			localResourceRoots: [],
		});
		expect(mockVscode.webviewHtml).toContain("Language server");
		expect(mockVscode.webviewHtml).toContain("1.2.3");
		expect(mockVscode.webviewHtml).toContain("4.5.6");
		expect(mockVscode.webviewHtml).toContain("0.2.0");
		expect(mockVscode.webviewHtml).not.toContain('class="scrim"');
	});

	test("open focuses panel webview and refreshes content", async () => {
		const { BeskidModalPanel, BESKID_DASHBOARD_VIEW_ID } =
			await loadModalPanelModule();
		const runtime = createRuntimeMock({ cliVersion: "before" });
		const panel = new BeskidModalPanel(runtime as never, "0.2.0");
		panel.resolveWebviewView(
			mockVscode.createWebviewView() as never,
			{} as never,
			{} as never,
		);

		runtime.setSnapshot({ cliVersion: "after" });
		await panel.open();

		expect(mockVscode.executeCommand).toHaveBeenCalledWith(
			`${BESKID_DASHBOARD_VIEW_ID}.focus`,
		);
		expect(mockVscode.webviewHtml).toContain("after");
	});

	test("open is safe before the webview view is resolved", async () => {
		const { BeskidModalPanel, BESKID_DASHBOARD_VIEW_ID } =
			await loadModalPanelModule();
		const panel = new BeskidModalPanel(createRuntimeMock() as never, "0.2.0");
		await expect(panel.open()).resolves.toBeUndefined();
		expect(mockVscode.executeCommand).toHaveBeenCalledWith(
			`${BESKID_DASHBOARD_VIEW_ID}.focus`,
		);
		expect(mockVscode.webviewHtml).toBe("");
	});

	test("refresh no-ops when view is not resolved", async () => {
		const { BeskidModalPanel } = await loadModalPanelModule();
		const runtime = createRuntimeMock({ cliVersion: "orphan" });
		const panel = new BeskidModalPanel(runtime as never, "0.2.0");
		runtime.setSnapshot({ cliVersion: "changed" });
		panel.refresh();
		expect(mockVscode.webviewHtml).toBe("");
	});

	test("runtime onDidChange refreshes resolved dashboard HTML", async () => {
		const { BeskidModalPanel } = await loadModalPanelModule();
		const runtime = createRuntimeMock({ phase: "starting" });
		const panel = new BeskidModalPanel(runtime as never, "0.2.0");
		panel.register({ subscriptions: mockVscode.subscriptions } as never);
		panel.resolveWebviewView(
			mockVscode.createWebviewView() as never,
			{} as never,
			{} as never,
		);

		runtime.setSnapshot({
			phase: "running",
			scan: { active: true, current: 2, total: 5, message: "Stub.bd" },
		});

		expect(mockVscode.webviewHtml).toContain("badge--scanning");
		expect(mockVscode.webviewHtml).toContain("2 / 5");
		expect(mockVscode.webviewHtml).toContain("Stub.bd");
	});

	test("webview command messages execute VS Code commands", async () => {
		const { BeskidModalPanel } = await loadModalPanelModule();
		const panel = new BeskidModalPanel(createRuntimeMock() as never, "0.2.0");
		panel.resolveWebviewView(
			mockVscode.createWebviewView() as never,
			{} as never,
			{} as never,
		);

		mockVscode.triggerMessage({ type: "command", command: "beskid.lsp.restart" });
		await Promise.resolve();

		expect(mockVscode.executeCommand).toHaveBeenCalledWith("beskid.lsp.restart");
	});

	test("webview ignores malformed command messages", async () => {
		const { BeskidModalPanel } = await loadModalPanelModule();
		const panel = new BeskidModalPanel(createRuntimeMock() as never, "0.2.0");
		panel.resolveWebviewView(
			mockVscode.createWebviewView() as never,
			{} as never,
			{} as never,
		);
		mockVscode.executeCommand.mockClear();

		mockVscode.triggerMessage({ type: "command" });
		mockVscode.triggerMessage({ type: "close" });
		mockVscode.triggerMessage(null);
		mockVscode.triggerMessage("restart");
		await Promise.resolve();

		expect(mockVscode.executeCommand).not.toHaveBeenCalled();
	});

	test("dispose clears resolved view so refresh becomes a no-op", async () => {
		const { BeskidModalPanel } = await loadModalPanelModule();
		const runtime = createRuntimeMock({ cliVersion: "live" });
		const panel = new BeskidModalPanel(runtime as never, "0.2.0");
		panel.resolveWebviewView(
			mockVscode.createWebviewView() as never,
			{} as never,
			{} as never,
		);
		mockVscode.triggerDispose();

		runtime.setSnapshot({ cliVersion: "stale-should-not-render" });
		panel.refresh();

		expect(mockVscode.webviewHtml).toContain("live");
		expect(mockVscode.webviewHtml).not.toContain("stale-should-not-render");
	});

	test("does not register editor-tab webview panels", () => {
		const contents = readFileSync(
			join(import.meta.dirname, "../src/dashboard/BeskidModalPanel.ts"),
			"utf8",
		);
		expect(contents).toContain("registerWebviewViewProvider");
		expect(contents).not.toContain("createWebviewPanel");
	});
});
