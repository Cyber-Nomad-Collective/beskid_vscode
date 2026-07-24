import type * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { fromLspCommandResult, type LspOutcome } from "../lsp/lspBoundary.js";
import { lspExecuteCommand } from "../lsp/lspExecuteCommand.js";
import {
	mapPckgConnectionStatus,
	mapPckgValidateConnectionResult,
} from "./pckgConnectionMapping.js";
import type {
	PckgConnectionStatus,
	PckgValidateConnectionResult,
} from "./pckgConnectionTypes.js";

export class LspPckgApi {
	constructor(
		private readonly getClient: () => LanguageClient | undefined,
		private readonly outputChannel?: vscode.OutputChannel,
	) {}

	async getConnectionStatus(input: {
		workspaceUri?: string;
		authConfigured: boolean;
	}): Promise<LspOutcome<PckgConnectionStatus>> {
		const outcome = await this.execute<Record<string, unknown>>(
			"beskid.pckg.getConnectionStatus",
			[input],
		);
		if (!outcome.ok) {
			return outcome;
		}
		return { ok: true, value: mapPckgConnectionStatus(outcome.value) };
	}

	async setRegistry(input: {
		baseUrl: string;
		registryName?: string;
	}): Promise<LspOutcome<void>> {
		const outcome = await this.execute<unknown>("beskid.pckg.setRegistry", [
			input,
		]);
		if (!outcome.ok) {
			return outcome;
		}
		return { ok: true, value: undefined };
	}

	async validateConnection(input: {
		baseUrl?: string;
		workspaceUri?: string;
		apiKey?: string;
	}): Promise<LspOutcome<PckgValidateConnectionResult>> {
		const outcome = await this.execute<Record<string, unknown>>(
			"beskid.pckg.validateConnection",
			[input],
		);
		if (!outcome.ok) {
			return outcome;
		}
		return { ok: true, value: mapPckgValidateConnectionResult(outcome.value) };
	}

	private async execute<T>(
		command: string,
		args: unknown[],
	): Promise<LspOutcome<T>> {
		const result = await lspExecuteCommand<T>(
			this.getClient(),
			command,
			args,
			this.outputChannel,
		);
		return fromLspCommandResult(result);
	}
}
