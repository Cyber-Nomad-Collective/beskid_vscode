import { describe, expect, test } from "bun:test";
import {
	defaultLspInstallPath,
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

describe("defaultLspInstallPath", () => {
	test("installs under ~/.beskid/bin", () => {
		expect(defaultLspInstallPath("darwin", "arm64")).toMatch(
			/\.beskid[/\\]bin[/\\]beskid_lsp$/,
		);
		expect(defaultLspInstallPath("win32", "x64")).toMatch(
			/\.beskid[/\\]bin[/\\]beskid_lsp\.exe$/,
		);
	});
});
