import { describe, expect, test } from "bun:test";
import {
	cliReleaseDownloadUrl,
	cliVersionUrl,
	defaultCliInstallPath,
	resolveCliPlatformAsset,
} from "../src/cli/cliPlatform.js";

describe("resolveCliPlatformAsset", () => {
	test("maps supported release targets", () => {
		expect(resolveCliPlatformAsset("linux", "x64")).toEqual({
			releaseAsset: "beskid-linux-amd64",
			installFileName: "beskid",
		});
		expect(resolveCliPlatformAsset("darwin", "arm64")).toEqual({
			releaseAsset: "beskid-darwin-arm64",
			installFileName: "beskid",
		});
		expect(resolveCliPlatformAsset("win32", "x64")).toEqual({
			releaseAsset: "beskid-windows-amd64.exe",
			installFileName: "beskid.exe",
		});
	});

	test("rejects unsupported platforms", () => {
		expect(resolveCliPlatformAsset("darwin", "x64")).toBeUndefined();
		expect(resolveCliPlatformAsset("linux", "arm64")).toBeUndefined();
	});
});

describe("release URLs", () => {
	test("uses GitHub release download layout", () => {
		expect(cliReleaseDownloadUrl("cli-latest", "beskid-darwin-arm64")).toBe(
			"https://github.com/Cyber-Nomad-Collective/beskid_compiler/releases/download/cli-latest/beskid-darwin-arm64",
		);
		expect(cliVersionUrl("cli-latest")).toBe(
			"https://github.com/Cyber-Nomad-Collective/beskid_compiler/releases/download/cli-latest/cli-version.txt",
		);
	});
});

describe("defaultCliInstallPath", () => {
	test("installs under ~/.beskid/bin", () => {
		expect(defaultCliInstallPath("darwin", "arm64")).toMatch(
			/\.beskid[/\\]bin[/\\]beskid$/,
		);
		expect(defaultCliInstallPath("win32", "x64")).toMatch(
			/\.beskid[/\\]bin[/\\]beskid\.exe$/,
		);
	});
});
