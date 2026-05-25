import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { defaultCliInstallPath } from "../cli/cliPlatform.js";

export function resolveCliExecutablePath(): string | undefined {
  const configured =
    vscode.workspace.getConfiguration("beskid").get<string>("cli.path", "beskid") || "beskid";
  if (configured !== "beskid") {
    return existsSync(configured) ? configured : undefined;
  }
  const managed = defaultCliInstallPath();
  return existsSync(managed) ? managed : undefined;
}

export function readCliPath(): string {
  return resolveCliExecutablePath() ?? "beskid";
}

export function readPckgBaseUrl(): string {
  return (
    vscode.workspace.getConfiguration("beskid").get<string>("pckg.baseUrl") ??
    "http://localhost:5000"
  );
}

export function readCliReleaseTag(): string {
  return (
    vscode.workspace.getConfiguration("beskid").get<string>("cli.releaseTag", "cli-latest") ||
    "cli-latest"
  );
}

export function readAutoSelectFromEditor(): boolean {
  return (
    vscode.workspace.getConfiguration("beskid").get<boolean>("project.autoSelectFromEditor", true) ??
    true
  );
}

export function readLspLogLevel(): string {
  return (
    vscode.workspace.getConfiguration("beskid.lsp").get<string>("log.level", "info") ?? "info"
  );
}

export function readLogServerOutput(): boolean {
  return vscode.workspace.getConfiguration("beskid.lsp").get<boolean>("log.serverOutput", true);
}

export async function readPckgApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const configured = vscode.workspace.getConfiguration("beskid").get<string>("pckg.apiKey", "").trim();
  if (configured.length > 0) {
    return configured;
  }
  return (await context.secrets.get("beskid.pckg.apiKey")) ?? undefined;
}

export async function storePckgApiKey(
  context: vscode.ExtensionContext,
  apiKey: string | undefined,
): Promise<void> {
  if (!apiKey?.trim()) {
    await context.secrets.delete("beskid.pckg.apiKey");
    return;
  }
  await context.secrets.store("beskid.pckg.apiKey", apiKey.trim());
}
