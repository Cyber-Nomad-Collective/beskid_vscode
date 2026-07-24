import * as vscode from "vscode";
import type { BeskidLspSession } from "../runtime/BeskidLspSession.js";

export type LspCommandHandlers = {
	startLsp: () => Promise<void>;
	stopLsp: () => Promise<void>;
	restartLsp: () => Promise<void>;
	openLogs: () => void;
	quickActions: () => Promise<void>;
};

export function registerLspCommands(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
	session: BeskidLspSession,
	quickActions: () => Promise<void>,
): LspCommandHandlers {
	const handlers: LspCommandHandlers = {
		startLsp: async () => {
			await session.start();
		},
		stopLsp: async () => session.stop(),
		restartLsp: async () => {
			await session.restart();
		},
		openLogs: () => outputChannel.show(true),
		quickActions,
	};

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"beskid.lsp.quickActions",
			handlers.quickActions,
		),
		vscode.commands.registerCommand("beskid.lsp.start", handlers.startLsp),
		vscode.commands.registerCommand("beskid.lsp.stop", handlers.stopLsp),
		vscode.commands.registerCommand("beskid.lsp.restart", handlers.restartLsp),
		vscode.commands.registerCommand("beskid.lsp.openLogs", handlers.openLogs),
	);

	return handlers;
}
