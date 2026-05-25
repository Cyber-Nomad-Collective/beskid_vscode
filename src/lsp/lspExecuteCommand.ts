import type { LanguageClient } from "vscode-languageclient/node";

/** Run an LSP `workspace/executeCommand`; returns undefined when the client is missing or the request fails. */
export async function lspExecuteCommand<T>(
  client: LanguageClient | undefined,
  command: string,
  args: unknown[],
): Promise<T | undefined> {
  if (!client) {
    return undefined;
  }
  try {
    return (await client.sendRequest("workspace/executeCommand", { command, arguments: args })) as T;
  } catch {
    return undefined;
  }
}
