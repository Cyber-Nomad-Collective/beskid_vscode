import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveFocusManifestPath } from "../src/workspace/resolveFocusManifestPath.js";

function treeItem(projectUri?: string) {
	return { nodeType: "member" as const, projectUri };
}

describe("resolveFocusManifestPath", () => {
	test("returns undefined for missing input", () => {
		expect(resolveFocusManifestPath(undefined)).toBeUndefined();
		expect(resolveFocusManifestPath("")).toBeUndefined();
		expect(resolveFocusManifestPath("   ")).toBeUndefined();
	});

	test("resolves bproj file path string", () => {
		expect(resolveFocusManifestPath("/repo/apps/demo/demo.bproj")).toBe(
			"/repo/apps/demo/demo.bproj",
		);
	});

	test("resolves file URI string", () => {
		expect(resolveFocusManifestPath("file:///repo/apps/demo/demo.bproj")).toBe(
			"/repo/apps/demo/demo.bproj",
		);
	});

	test("walks up from source file to ancestor bproj", () => {
		const root = mkdtempSync(join(tmpdir(), "beskid-focus-"));
		try {
			writeFileSync(
				join(root, "demo.bproj"),
				`demo {
  name = "demo"
  version = "0.1.0"
}
`,
			);
			const srcDir = join(root, "src");
			mkdirSync(srcDir, { recursive: true });
			const sourceFile = join(srcDir, "main.bd");
			writeFileSync(sourceFile, "");
			const path = resolveFocusManifestPath(sourceFile);
			expect(path?.replaceAll("\\", "/")).toBe(
				join(root, "demo.bproj").replaceAll("\\", "/"),
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	test("returns undefined for workspace manifest paths", () => {
		expect(resolveFocusManifestPath("/repo/Demo.bws")).toBeUndefined();
		expect(resolveFocusManifestPath("file:///repo/Demo.bws")).toBeUndefined();
	});

	test("resolves ProjectsTreeItem projectUri", () => {
		expect(resolveFocusManifestPath(treeItem("/repo/apps/demo/demo.bproj"))).toBe(
			"/repo/apps/demo/demo.bproj",
		);
	});

	test("returns undefined when tree item has no projectUri", () => {
		expect(resolveFocusManifestPath(treeItem())).toBeUndefined();
		expect(resolveFocusManifestPath(treeItem("  "))).toBeUndefined();
	});

	test("normalizes backslashes in bproj paths", () => {
		expect(resolveFocusManifestPath("C:\\repo\\demo.bproj")).toBe(
			"C:/repo/demo.bproj",
		);
	});
});
