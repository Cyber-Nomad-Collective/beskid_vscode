import { describe, expect, test } from "bun:test";
import { migrateLockTargetPath } from "../src/cli/migrateLock.js";

describe("migrateLockTargetPath", () => {
	test("accepts a Project.lock or .bproj uri or path", () => {
		expect(migrateLockTargetPath("file:///w/app/Project.lock")).toBe("/w/app/Project.lock");
		expect(migrateLockTargetPath({ uri: "file:///w/app/App.bproj" })).toBe("/w/app/App.bproj");
		expect(migrateLockTargetPath({ fsPath: "/w/app/Project.lock" })).toBe("/w/app/Project.lock");
	});

	test("anything else falls back to the focused project", () => {
		expect(migrateLockTargetPath(undefined)).toBeUndefined();
		expect(migrateLockTargetPath("file:///w/app/main.bd")).toBeUndefined();
		expect(migrateLockTargetPath(42)).toBeUndefined();
	});
});
