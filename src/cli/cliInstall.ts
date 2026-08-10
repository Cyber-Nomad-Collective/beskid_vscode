import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { readCliReleaseTag } from "../config/workspaceSettings.js";
import { appendToolchainFailure } from "./cliErrors.js";
import {
	cliReleaseDownloadUrl,
	cliVersionUrl,
	defaultCliInstallDir,
	resolveCliPlatformAsset,
} from "./cliPlatform.js";

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

export type CliInstallResult = {
	path: string;
	version: string;
	releaseTag: string;
};

export async function installBeskidCli(
	outputChannel: vscode.OutputChannel,
	releaseTag = readCliReleaseTag(),
): Promise<CliInstallResult> {
	const tag = releaseTag.trim() || "cli-stable";
	const asset = resolveCliPlatformAsset();
	if (!asset) {
		throw new Error(
			`Unsupported platform: ${process.platform}-${process.arch}. ` +
				"Published builds cover Linux x86_64, macOS Apple Silicon, and Windows x86_64.",
		);
	}

	const versionUrl = cliVersionUrl(tag);
	const downloadUrl = cliReleaseDownloadUrl(tag, asset.releaseAsset);
	const installPath = join(defaultCliInstallDir(), asset.installFileName);

	try {
		outputChannel.appendLine(`Fetching version from ${versionUrl}`);
		const version = await fetchText(versionUrl);
		if (!version) {
			throw new Error(`cli-version.txt from ${versionUrl} was empty.`);
		}

		outputChannel.appendLine(`Downloading ${downloadUrl}`);
		outputChannel.appendLine(
			`Installing Beskid CLI ${version} (${tag}) to ${installPath}`,
		);
		outputChannel.show(true);

		await downloadFile(downloadUrl, installPath);
		if (process.platform !== "win32") {
			chmodSync(installPath, 0o755);
		}

		await vscode.workspace
			.getConfiguration("beskid")
			.update("cli.path", installPath, vscode.ConfigurationTarget.Global);

		return { path: installPath, version, releaseTag: tag };
	} catch (error) {
		const detail = appendToolchainFailure(outputChannel, "CLI download", error, {
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
