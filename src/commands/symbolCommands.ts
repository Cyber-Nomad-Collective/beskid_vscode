import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { readBookBaseUrl, readSpecBaseUrl } from "../config/workspaceSettings.js";
import { buildFallbackDocsUrl, resolveDocumentationUrl } from "./docsUrls.js";
import { lspExecuteCommand } from "../lsp/lspExecuteCommand.js";

export { buildFallbackDocsUrl, buildPckgDocsUrl, resolveDocumentationUrl } from "./docsUrls.js";

export function registerSymbolCommands(
  context: ExtensionContext,
  getClient: () => LanguageClient | undefined,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("beskid.openSymbolDocumentation", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showWarningMessage("Open a Beskid source file first.");
        return;
      }
      const lang = editor.document.languageId;
      if (lang !== "beskid" && lang !== "beskid-proj") {
        return;
      }
      const offset = editor.document.offsetAt(editor.selection.active);
      const uri = editor.document.uri.toString();
      const raw = await lspExecuteCommand<{ url?: string }>(getClient(), "beskid.symbol.getDocumentationUri", [
        { uri, offset },
      ]);
      const url = raw?.url?.trim();
      if (url) {
        await vscode.env.openExternal(
          vscode.Uri.parse(
            resolveDocumentationUrl(url, {
              specBaseUrl: readSpecBaseUrl(),
              bookBaseUrl: readBookBaseUrl(),
            }),
          ),
        );
        return;
      }
      await vscode.env.openExternal(
        vscode.Uri.parse(buildFallbackDocsUrl(undefined, { bookBaseUrl: readBookBaseUrl() })),
      );
    }),
  );
}
