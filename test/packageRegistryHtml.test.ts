import { describe, expect, test } from "bun:test";
import { renderPackageRegistryHtml } from "../src/packages/packageRegistryHtml.js";
import type { PackageDetails } from "../src/packages/pckgTypes.js";
import { renderPackageMarkdown } from "../src/packages/renderPackageMarkdown.js";

const libraryDetails: PackageDetails = {
	package: {
		name: "corelib",
		packageKind: "library",
		description: "Standard library",
	},
	latestVersion: "0.4.0",
	versions: [{ version: "0.4.0", isYanked: false }],
	dependencies: [],
	dependentsCount: 0,
	readme:
		"# corelib\n\n**Generated surfaces** for `Beskid.Compiler.*`.\n\n- item one\n- item two",
};

describe("renderPackageMarkdown", () => {
	test("renders headings and lists", () => {
		const html = renderPackageMarkdown("# Title\n\n- one");
		expect(html).toContain("<h1>Title</h1>");
		expect(html).toContain("<li>one</li>");
	});

	test("strips script tags", () => {
		const html = renderPackageMarkdown("# ok<script>alert(1)</script>");
		expect(html).not.toContain("<script");
		expect(html).toContain("<h1>ok</h1>");
	});
});

describe("renderPackageRegistryHtml", () => {
	test("detail pane links library packages to pckg API docs", () => {
		const html = renderPackageRegistryHtml({
			query: "",
			loading: false,
			rows: [],
			selected: "corelib",
			details: libraryDetails,
			registryBaseUrl: "https://pckg.beskid-lang.org",
			logoUri: "https://example.test/logo.svg",
		});
		expect(html).toContain("Open API docs");
		expect(html).toContain("/docs/corelib@0.4.0");
		expect(html).toContain('class="toolbar-logo"');
		expect(html).toContain('class="action-btn primary"');
		expect(html).toContain('class="readme markdown-body"');
		expect(html).toContain("<h1>corelib</h1>");
		expect(html).toContain("<strong>Generated surfaces</strong>");
		expect(html).not.toContain('<pre class="readme">');
	});
});
