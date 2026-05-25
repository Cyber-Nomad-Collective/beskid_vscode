import { describe, expect, test } from "bun:test";
import {
  defaultLspInstallPath,
  lspReleaseDownloadUrl,
  lspVersionUrl,
  resolveLspPlatformAsset,
} from "../src/cli/lspPlatform.js";

describe("resolveLspPlatformAsset", () => {
  test("maps supported release targets", () => {
    expect(resolveLspPlatformAsset("linux", "x64")).toEqual({
      releaseAsset: "beskid_lsp-linux-amd64",
      installFileName: "beskid_lsp",
    });
    expect(resolveLspPlatformAsset("darwin", "arm64")).toEqual({
      releaseAsset: "beskid_lsp-darwin-arm64",
      installFileName: "beskid_lsp",
    });
    expect(resolveLspPlatformAsset("win32", "x64")).toEqual({
      releaseAsset: "beskid_lsp-windows-amd64.exe",
      installFileName: "beskid_lsp.exe",
    });
  });

  test("rejects unsupported platforms", () => {
    expect(resolveLspPlatformAsset("darwin", "x64")).toBeUndefined();
    expect(resolveLspPlatformAsset("linux", "arm64")).toBeUndefined();
  });
});

describe("LSP release URLs", () => {
  test("uses GitHub release download layout", () => {
    expect(lspReleaseDownloadUrl("lsp-latest", "beskid_lsp-darwin-arm64")).toBe(
      "https://github.com/Cyber-Nomad-Collective/beskid_compiler/releases/download/lsp-latest/beskid_lsp-darwin-arm64",
    );
    expect(lspVersionUrl("lsp-latest")).toBe(
      "https://github.com/Cyber-Nomad-Collective/beskid_compiler/releases/download/lsp-latest/lsp-version.txt",
    );
  });
});

describe("defaultLspInstallPath", () => {
  test("installs under ~/.beskid/bin", () => {
    expect(defaultLspInstallPath("darwin", "arm64")).toMatch(/\.beskid[/\\]bin[/\\]beskid_lsp$/);
    expect(defaultLspInstallPath("win32", "x64")).toMatch(/\.beskid[/\\]bin[/\\]beskid_lsp\.exe$/);
  });
});
