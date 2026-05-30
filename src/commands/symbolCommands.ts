import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { lspExecuteCommand } from "../lsp/lspExecuteCommand.js";
import { readPckgBaseUrl } from "../config/workspaceSettings.js";

function readBookBaseUrl(): string {
  return (
    vscode.workspace.getConfiguration("beskid").get<string>("docs.bookBaseUrl") ??
    "https://beskid-lang.org"
  );
}

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
        await vscode.env.openExternal(vscode.Uri.parse(url));
        return;
      }
      const bookBase = readBookBaseUrl().replace(/\/$/, "");
      await vscode.env.openExternal(vscode.Uri.parse(`${bookBase}/book/`));
    }),
  );
}

export function buildFallbackDocsUrl(symbolName?: string): string {
  const bookBase = readBookBaseUrl().replace(/\/$/, "");
  if (symbolName?.trim()) {
    return `${bookBase}/book/?q=${encodeURIComponent(symbolName.trim())}`;
  }
  return `${bookBase}/book/`;
}

export function buildPckgDocsUrl(packageName: string, version: string, symbol?: string): string {
  const base = readPckgBaseUrl().replace(/\/$/, "");
  const atVersion = `${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  const fragment = symbol?.trim() ? `#${encodeURIComponent(symbol.trim())}` : "";
  return `${base}/docs/${atVersion}${fragment}`;
}
