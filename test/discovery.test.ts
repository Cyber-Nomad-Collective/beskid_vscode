import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	discoverProjectFileFromPath,
	discoverWorkspaceManifestInDir,
	isManifestUri,
	isProjectManifestUri,
} from "../src/workspace/manifestPath.js";

describe("discoverProjectFileFromPath", () => {
	test("returns bproj when path ends with demo.bproj", () => {
		expect(discoverProjectFileFromPath("/repo/apps/demo/demo.bproj")).toBe(
			"/repo/apps/demo/demo.bproj",
		);
	});

	test("returns undefined when no manifest exists", () => {
		expect(
			discoverProjectFileFromPath("/repo/apps/demo/src/main.bd"),
		).toBeUndefined();
	});

	test("walks up to ancestor .bproj", () => {
		const root = mkdtempSync(join(tmpdir(), "beskid-discovery-"));
		try {
			writeFileSync(
				join(root, "demo.bproj"),
				`demo {
  name = "demo"
  version = "0.1.0"
}
`,
			);
			const srcDir = join(root, "src", "lib");
			mkdirSync(srcDir, { recursive: true });
			const sourceFile = join(srcDir, "main.bd");
			writeFileSync(sourceFile, "");
			const discovered = discoverProjectFileFromPath(sourceFile);
			expect(discovered?.replaceAll("\\", "/")).toBe(
				join(root, "demo.bproj").replaceAll("\\", "/"),
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	test("returns undefined when directory has multiple bproj files", () => {
		const root = mkdtempSync(join(tmpdir(), "beskid-discovery-"));
		try {
			writeFileSync(join(root, "a.bproj"), 'a { name = "a" version = "1" }\n');
			writeFileSync(join(root, "b.bproj"), 'b { name = "b" version = "1" }\n');
			expect(
				discoverProjectFileFromPath(join(root, "src/main.bd")),
			).toBeUndefined();
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});

describe("manifest uri helpers", () => {
	test("detects bproj and bws paths", () => {
		expect(isProjectManifestUri("/repo/demo.bproj")).toBe(true);
		expect(isManifestUri("/repo/CoreLib.bws")).toBe(true);
		expect(isProjectManifestUri("/repo/CoreLib.bws")).toBe(false);
	});

	test("discovers single bws in directory", () => {
		const root = mkdtempSync(join(tmpdir(), "beskid-workspace-"));
		try {
			writeFileSync(
				join(root, "Demo.bws"),
				`workspace {
  name = "Demo"
  resolver = v1
}
`,
			);
			expect(discoverWorkspaceManifestInDir(root)).toBe(
				join(root, "Demo.bws").replaceAll("\\", "/"),
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
