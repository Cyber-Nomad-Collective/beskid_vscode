import { describe, expect, test } from "bun:test";
import {
	bundledPlatformArchKeys,
	platformArchKey,
	resolveBundledServerBinaryAt,
} from "../src/lsp/serverBinary.js";

describe("serverBinary", () => {
	test("platformArchKey returns a supported host key", () => {
		const key = platformArchKey();
		expect(key).toBeDefined();
		expect(key).toMatch(/^(linux|darwin|win32)-(x64|arm64)$/);
	});

	test("bundledPlatformArchKeys includes macOS cross-arch fallback", () => {
		const keys = bundledPlatformArchKeys();
		expect(keys.length).toBeGreaterThan(0);
		if (keys[0]?.startsWith("darwin-")) {
			expect(keys).toEqual(
				keys[0] === "darwin-arm64"
					? ["darwin-arm64", "darwin-x64"]
					: ["darwin-x64", "darwin-arm64"],
			);
		} else {
			expect(keys).toEqual([keys[0]]);
		}
	});

	test("resolveBundledServerBinaryAt checks keys in order", () => {
		const extensionPath = "/tmp/beskid-vscode-test";
		const keys = ["darwin-x64", "darwin-arm64"] as const;
		expect(resolveBundledServerBinaryAt(extensionPath, keys)).toBeUndefined();
	});

	test("no longer offers compiler checkout discovery", async () => {
		const exports = await import("../src/lsp/serverBinary.js");
		expect(Object.keys(exports).sort()).toEqual([
			"bundledPlatformArchKeys",
			"compilerBinaryName",
			"platformArchKey",
			"resolveBundledServerBinaryAt",
		]);
	});
});
