import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type * as vscode from "vscode";
import { readLspReleaseTag } from "../config/workspaceSettings.js";
import { appendToolchainFailure } from "./cliErrors.js";
import {
	defaultLspInstallDir,
	lspReleaseDownloadUrl,
	lspVersionUrl,
	resolveLspPlatformAsset,
} from "./lspPlatform.js";

async function fetchText(url: string): Promise<string> {
	let response: Response;
	try {
		response = await fetch(url);
	} catch (error) {
		throw new Error(`Network error fetching ${url}`, { cause: error });
	}
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
	}
	return (await response.text()).trim();
}

async function downloadFile(url: string, destPath: string): Promise<void> {
	let response: Response;
	try {
		response = await fetch(url);
	} catch (error) {
		throw new Error(`Network error downloading ${url}`, { cause: error });
	}
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
	}
	mkdirSync(join(destPath, ".."), { recursive: true });
	writeFileSync(destPath, Buffer.from(await response.arrayBuffer()));
}

export type LspInstallResult = {
	path: string;
	version: string;
	releaseTag: string;
};

export async function installBeskidLsp(
	outputChannel: vscode.OutputChannel,
	releaseTag = readLspReleaseTag(),
): Promise<LspInstallResult> {
	const tag = releaseTag.trim() || "lsp-stable";
	const asset = resolveLspPlatformAsset();
	if (!asset) {
		throw new Error(
			`Unsupported platform: ${process.platform}-${process.arch}. ` +
				"Published LSP builds cover Linux x86_64, macOS Apple Silicon, and Windows x86_64.",
		);
	}

	const versionUrl = lspVersionUrl(tag);
	const downloadUrl = lspReleaseDownloadUrl(tag, asset.releaseAsset);
	const installPath = join(defaultLspInstallDir(), asset.installFileName);

	try {
		outputChannel.appendLine(`Fetching LSP version from ${versionUrl}`);
		const version = await fetchText(versionUrl);
		if (!version) {
			throw new Error(`lsp-version.txt from ${versionUrl} was empty.`);
		}

		outputChannel.appendLine(`Downloading ${downloadUrl}`);
		outputChannel.appendLine(
			`Installing Beskid LSP ${version} (${tag}) to ${installPath}`,
		);
		outputChannel.show(true);

		await downloadFile(downloadUrl, installPath);
		if (process.platform !== "win32") {
			chmodSync(installPath, 0o755);
		}

		return { path: installPath, version, releaseTag: tag };
	} catch (error) {
		const detail = appendToolchainFailure(outputChannel, "LSP download", error, {
			"release tag": tag,
			"version url": versionUrl,
			"download url": downloadUrl,
			"install path": installPath,
			platform: `${process.platform}-${process.arch}`,
			asset: asset.releaseAsset,
		});
		throw new Error(detail);
	}
}
