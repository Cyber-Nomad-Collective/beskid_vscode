import { describe, expect, test } from "bun:test";
import {
	normalizeCliReleaseTag,
	normalizeLspReleaseTag,
	pinnedCliReleaseTag,
	pinnedLspReleaseTag,
} from "../src/cli/releaseTags.js";

describe("normalizeCliReleaseTag", () => {
	test("keeps rolling and pinned tags", () => {
		expect(normalizeCliReleaseTag("cli-latest")).toBe("cli-latest");
		expect(normalizeCliReleaseTag("cli-v0.1.77")).toBe("cli-v0.1.77");
	});

	test("maps bare semver to pinned GitHub tag", () => {
		expect(normalizeCliReleaseTag("0.1.77")).toBe("cli-v0.1.77");
		expect(normalizeCliReleaseTag("v0.1.77")).toBe("cli-v0.1.77");
	});

	test("defaults empty to rolling tag", () => {
		expect(normalizeCliReleaseTag("")).toBe("cli-latest");
		expect(normalizeCliReleaseTag("   ")).toBe("cli-latest");
	});
});

describe("normalizeLspReleaseTag", () => {
	test("keeps rolling and pinned tags", () => {
		expect(normalizeLspReleaseTag("lsp-latest")).toBe("lsp-latest");
		expect(normalizeLspReleaseTag("lsp-v0.1.77")).toBe("lsp-v0.1.77");
	});

	test("maps bare semver to pinned GitHub tag", () => {
		expect(normalizeLspReleaseTag("0.1.77")).toBe("lsp-v0.1.77");
		expect(normalizeLspReleaseTag("v0.1.77")).toBe("lsp-v0.1.77");
	});
});

describe("pinned release helpers", () => {
	test("alias semver normalization", () => {
		expect(pinnedCliReleaseTag("0.1.77")).toBe("cli-v0.1.77");
		expect(pinnedLspReleaseTag("0.1.77")).toBe("lsp-v0.1.77");
	});
});
