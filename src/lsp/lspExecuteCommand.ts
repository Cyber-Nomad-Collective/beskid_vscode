import type * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

export class LspCommandError extends Error {
	readonly command: string;
	readonly cause: unknown;

	constructor(command: string, cause: unknown) {
		const detail = formatLspCommandFailure(cause);
		super(`executeCommand ${command} failed: ${detail}`);
		this.name = "LspCommandError";
		this.command = command;
		this.cause = cause;
	}
}

export type LspCommandResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: LspCommandError };

function formatLspCommandFailure(cause: unknown): string {
	if (cause instanceof Error) {
		return cause.message;
	}
	if (typeof cause === "string") {
		return cause;
	}
	try {
		return JSON.stringify(cause);
	} catch {
		return String(cause);
	}
}

function logLspCommandFailure(
	outputChannel: vscode.OutputChannel | undefined,
	_command: string,
	error: LspCommandError,
): void {
	if (!outputChannel) {
		return;
	}
	outputChannel.appendLine(`[Beskid LSP] ${error.message}`);
	if (error.cause instanceof Error && error.cause.stack) {
		outputChannel.appendLine(error.cause.stack);
	}
}

/** Run an LSP `workspace/executeCommand` with typed success/error discrimination. */
export async function lspExecuteCommand<T>(
	client: LanguageClient | undefined,
	command: string,
	args: unknown[],
	outputChannel?: vscode.OutputChannel,
): Promise<LspCommandResult<T>> {
	if (!client) {
		const error = new LspCommandError(command, "language client is not running");
		logLspCommandFailure(outputChannel, command, error);
		return { ok: false, error };
	}
	try {
		const value = (await client.sendRequest("workspace/executeCommand", {
			command,
			arguments: args,
		})) as T;
		return { ok: true, value };
	} catch (cause) {
		const error = new LspCommandError(command, cause);
		logLspCommandFailure(outputChannel, command, error);
		return { ok: false, error };
	}
}

/** Convenience for callers that treat a failed command as absent data. */
export function unwrapLspResult<T>(result: LspCommandResult<T>): T | undefined {
	return result.ok ? result.value : undefined;
}
