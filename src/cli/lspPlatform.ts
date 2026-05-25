import { homedir } from "node:os";
import { join } from "node:path";
import { CLI_GITHUB_REPO } from "./cliPlatform.js";

export type LspPlatformAsset = {
  releaseAsset: string;
  installFileName: string;
};

export function resolveLspPlatformAsset(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): LspPlatformAsset | undefined {
  const normalizedArch = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : undefined;
  if (!normalizedArch) {
    return undefined;
  }

  if (platform === "linux" && normalizedArch === "amd64") {
    return { releaseAsset: "beskid_lsp-linux-amd64", installFileName: "beskid_lsp" };
  }
  if (platform === "darwin" && normalizedArch === "arm64") {
    return { releaseAsset: "beskid_lsp-darwin-arm64", installFileName: "beskid_lsp" };
  }
  if (platform === "win32" && normalizedArch === "amd64") {
    return {
      releaseAsset: "beskid_lsp-windows-amd64.exe",
      installFileName: "beskid_lsp.exe",
    };
  }
  return undefined;
}

export function defaultLspInstallDir(): string {
  return join(homedir(), ".beskid", "bin");
}

export function defaultLspInstallPath(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  const asset = resolveLspPlatformAsset(platform, arch);
  if (!asset) {
    return join(
      defaultLspInstallDir(),
      platform === "win32" ? "beskid_lsp.exe" : "beskid_lsp",
    );
  }
  return join(defaultLspInstallDir(), asset.installFileName);
}

export function lspReleaseDownloadUrl(releaseTag: string, assetName: string): string {
  const tag = releaseTag.trim() || "lsp-latest";
  return `https://github.com/${CLI_GITHUB_REPO}/releases/download/${tag}/${assetName}`;
}

export function lspVersionUrl(releaseTag: string): string {
  const tag = releaseTag.trim() || "lsp-latest";
  return `https://github.com/${CLI_GITHUB_REPO}/releases/download/${tag}/lsp-version.txt`;
}
