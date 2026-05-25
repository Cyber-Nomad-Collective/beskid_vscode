import type { LanguageClient } from "vscode-languageclient/node";
import { lspExecuteCommand } from "../lsp/lspExecuteCommand.js";
import type {
  PckgConnectionStatus,
  PckgValidateConnectionResult,
} from "./pckgConnectionTypes.js";
import {
  mapPckgConnectionStatus,
  mapPckgValidateConnectionResult,
} from "./pckgConnectionMapping.js";

export class LspPckgApi {
  constructor(private readonly getClient: () => LanguageClient | undefined) {}

  async getConnectionStatus(input: {
    workspaceUri?: string;
    authConfigured: boolean;
  }): Promise<PckgConnectionStatus | undefined> {
    const raw = await lspExecuteCommand<Record<string, unknown>>(
      this.getClient(),
      "beskid.pckg.getConnectionStatus",
      [input],
    );
    if (!raw) {
      return undefined;
    }
    return mapPckgConnectionStatus(raw);
  }

  async setRegistry(input: { baseUrl: string; registryName?: string }): Promise<boolean> {
    if (!this.getClient()) {
      return false;
    }
    await lspExecuteCommand<unknown>(this.getClient(), "beskid.pckg.setRegistry", [input]);
    return true;
  }

  async validateConnection(input: {
    baseUrl?: string;
    workspaceUri?: string;
    apiKey?: string;
  }): Promise<PckgValidateConnectionResult | undefined> {
    const raw = await lspExecuteCommand<Record<string, unknown>>(
      this.getClient(),
      "beskid.pckg.validateConnection",
      [input],
    );
    if (!raw) {
      return undefined;
    }
    return mapPckgValidateConnectionResult(raw);
  }
}
