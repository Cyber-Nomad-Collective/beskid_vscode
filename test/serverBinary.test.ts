import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
	bundledPlatformArchKeys,
	platformArchKey,
	resolveBundledServerBinaryAt,
	resolveCompilerReleaseBinary,
	resolveCompilerWorkspaceRoot,
} from "../src/lsp/serverBinary.js";

describe("serverBinary", () => {
	const extensionPath = fileURLToPath(new URL("../", import.meta.url)).replace(
		/[\\/]test[\\/]?$/,
		"",
	);

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

	test("resolveCompilerWorkspaceRoot finds sibling compiler checkout", () => {
		const root = resolveCompilerWorkspaceRoot(extensionPath, undefined);
		expect(root).toBeDefined();
		expect(root).toMatch(/[\\/]compiler$/);
	});

	test("resolveCompilerReleaseBinary returns release binary when present", () => {
		const compilerRoot = resolveCompilerWorkspaceRoot(extensionPath, undefined);
		if (!compilerRoot) {
			return;
		}
		const releaseBinary = resolveCompilerReleaseBinary(compilerRoot);
		if (!releaseBinary) {
			return;
		}
		expect(releaseBinary.endsWith("beskid_lsp")).toBe(true);
	});
});
