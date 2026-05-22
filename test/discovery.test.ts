import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { discoverProjectFileFromPath } from "../src/workspace/manifestPath.js";

describe("discoverProjectFileFromPath", () => {
  test("returns proj when path ends with Project.proj", () => {
    expect(discoverProjectFileFromPath("/repo/apps/demo/Project.proj")).toBe(
      "/repo/apps/demo/Project.proj",
    );
  });

  test("returns undefined when no manifest exists", () => {
    expect(discoverProjectFileFromPath("/repo/apps/demo/src/main.bd")).toBeUndefined();
  });

  test("walks up to ancestor Project.proj", () => {
    const root = mkdtempSync(join(tmpdir(), "beskid-discovery-"));
    try {
      writeFileSync(join(root, "Project.proj"), "project Demo;\n");
      const srcDir = join(root, "src", "lib");
      mkdirSync(srcDir, { recursive: true });
      const sourceFile = join(srcDir, "main.bd");
      writeFileSync(sourceFile, "");
      const discovered = discoverProjectFileFromPath(sourceFile);
      expect(discovered?.replaceAll("\\", "/")).toBe(join(root, "Project.proj").replaceAll("\\", "/"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
