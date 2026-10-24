import * as vscode from "vscode";

export function readPckgBaseUrl(): string {
	return (
		vscode.workspace.getConfiguration("beskid").get<string>("pckg.baseUrl") ??
		"https://pckg.beskid-lang.org"
	);
}

export function readBookBaseUrl(): string {
	return (
		vscode.workspace.getConfiguration("beskid").get<string>("docs.bookBaseUrl") ??
		"https://beskid-lang.org"
	);
}

export function readSpecBaseUrl(): string {
	return (
		vscode.workspace.getConfiguration("beskid").get<string>("docs.specBaseUrl") ??
		"https://spec.beskid-lang.org/platform-spec"
	);
}

/** Env vars forwarded to the LSP for documentation URL resolution. */
export function lspDocumentationEnv(): Record<string, string> {
	return {
		BESKID_BOOK_BASE_URL: readBookBaseUrl().replace(/\/$/, ""),
		BESKID_SPEC_BASE_URL: readSpecBaseUrl().replace(/\/$/, ""),
		BESKID_PCKG_BASE_URL: readPckgBaseUrl().replace(/\/$/, ""),
	};
}

export function readAutoSelectFromEditor(): boolean {
	return (
		vscode.workspace
			.getConfiguration("beskid")
			.get<boolean>("project.autoSelectFromEditor", true) ?? true
	);
}

export function readLspLogLevel(): string {
	return (
		vscode.workspace
			.getConfiguration("beskid.lsp")
			.get<string>("log.level", "info") ?? "info"
	);
}

export function readLogServerOutput(): boolean {
	return vscode.workspace
		.getConfiguration("beskid.lsp")
		.get<boolean>("log.serverOutput", true);
}

export function readDashboardOpenOnActivate(): boolean {
	return (
		vscode.workspace
			.getConfiguration("beskid")
			.get<boolean>("dashboard.openOnActivate", false) ?? false
	);
}

export async function readPckgApiKey(
	context: vscode.ExtensionContext,
): Promise<string | undefined> {
	const configured = vscode.workspace
		.getConfiguration("beskid")
		.get<string>("pckg.apiKey", "")
		.trim();
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
