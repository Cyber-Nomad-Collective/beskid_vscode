import { describe, expect, test } from "bun:test";
import { formatToolchainError } from "../src/cli/cliErrors.js";

describe("formatToolchainError", () => {
	test("includes phase, context, and stack", () => {
	const error = new Error("HTTP 404");
	error.stack = "Error: HTTP 404\n    at download";
	const text = formatToolchainError("CLI download", error, {
		"release tag": "cli-stable",
		platform: "darwin-arm64",
	});
	expect(text).toContain("[Beskid toolchain] CLI download failed");
		expect(text).toContain("release tag: cli-stable");
		expect(text).toContain("HTTP 404");
		expect(text).toContain("at download");
	});
});
