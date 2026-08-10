import { homedir } from "node:os";
import { join } from "node:path";

export const CLI_GITHUB_REPO = "Cyber-Nomad-Collective/beskid_compiler";

export type CliPlatformAsset = {
	releaseAsset: string;
	installFileName: string;
};

export function resolveCliPlatformAsset(
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch,
): CliPlatformAsset | undefined {
	const normalizedArch =
		arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : undefined;
	if (!normalizedArch) {
		return undefined;
	}

	if (platform === "linux" && normalizedArch === "amd64") {
		return { releaseAsset: "beskid-linux-amd64", installFileName: "beskid" };
	}
	if (platform === "darwin" && normalizedArch === "arm64") {
		return { releaseAsset: "beskid-darwin-arm64", installFileName: "beskid" };
	}
	if (platform === "win32" && normalizedArch === "amd64") {
		return {
			releaseAsset: "beskid-windows-amd64.exe",
			installFileName: "beskid.exe",
		};
	}
	return undefined;
}

export function defaultCliInstallDir(): string {
	return join(homedir(), ".beskid", "bin");
}

export function defaultCliInstallPath(
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch,
): string {
	const asset = resolveCliPlatformAsset(platform, arch);
	if (!asset) {
		return join(
			defaultCliInstallDir(),
			platform === "win32" ? "beskid.exe" : "beskid",
		);
	}
	return join(defaultCliInstallDir(), asset.installFileName);
}

export function cliReleaseDownloadUrl(
	releaseTag: string,
	assetName: string,
): string {
	const tag = releaseTag.trim() || "cli-stable";
	return `https://github.com/${CLI_GITHUB_REPO}/releases/download/${tag}/${assetName}`;
}

export function cliVersionUrl(releaseTag: string): string {
	const tag = releaseTag.trim() || "cli-stable";
	return `https://github.com/${CLI_GITHUB_REPO}/releases/download/${tag}/cli-version.txt`;
}
