import { describe, expect, test } from "bun:test";
import { WATCH_EXCLUDE_GLOBS, isExcludedWatchPath } from "../src/runtime/watchExclusions.js";

describe("isExcludedWatchPath", () => {
	test("excludes obj, target and .beskid at any depth", () => {
		expect(isExcludedWatchPath("/w/app/obj/corelib/Core/Text.bd")).toBe(true);
		expect(isExcludedWatchPath("/w/obj/x/Project.lock")).toBe(true);
		expect(isExcludedWatchPath("/w/compiler/target/debug/a.bd")).toBe(true);
		expect(isExcludedWatchPath("/w/.beskid/cache/a.bproj")).toBe(true);
		expect(isExcludedWatchPath("C:\\w\\app\\obj\\a.bd")).toBe(true);
	});

	test("keeps ordinary sources and similarly named files", () => {
		expect(isExcludedWatchPath("/w/app/src/main.bd")).toBe(false);
		expect(isExcludedWatchPath("/w/app/App.bproj")).toBe(false);
		expect(isExcludedWatchPath("/w/app/object/a.bd")).toBe(false);
		expect(isExcludedWatchPath("/w/app/obj")).toBe(false);
	});

	test("exposes the matching globs", () => {
		expect(WATCH_EXCLUDE_GLOBS).toEqual(["**/obj/**", "**/target/**", "**/.beskid/**"]);
	});
});
