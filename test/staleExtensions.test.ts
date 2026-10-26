import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	compareReleaseVersions,
	findStaleExtensionFolders,
	listStaleExtensionFolders,
} from "../src/cli/staleExtensions.js";
import {
	applyRemovalPlan,
	describeRemovalPlan,
	planStaleRemoval,
} from "../src/cli/toolchainRemoval.js";

const folders = [
	"beskid.beskid-vscode-0.4.0",
	"beskid.beskid-vscode-0.5.2",
	"beskid.beskid-vscode-0.6.6",
	"beskid.beskid-vscode-0.6.7-darwin-arm64",
	"beskid-lang.beskid-vscode-0.5.2-darwin-arm64",
	"beskid-lang.beskid-vscode-0.6.7",
	"beskid-lang.beskid-vscode-0.7.0",
	"beskid.beskid-vscode-0.6.10",
	"beskid.beskid-vscode-0.7.0-darwin-arm64",
	"beskid.beskid-vscode-0.6.7-rc.1",
	"beskid.beskid-vscode-0.6.6-rc.2",
	"ms-python.python-2024.1.0",
	"someone.beskid-vscode-fork-1.0.0",
];

describe("findStaleExtensionFolders", () => {
	test("lists only older versions and the old publisher id up to the running version", () => {
		expect(findStaleExtensionFolders(folders, "0.6.7")).toEqual([
			"beskid-lang.beskid-vscode-0.5.2-darwin-arm64",
			"beskid-lang.beskid-vscode-0.6.7",
			"beskid.beskid-vscode-0.4.0",
			"beskid.beskid-vscode-0.5.2",
			"beskid.beskid-vscode-0.6.6",
			"beskid.beskid-vscode-0.6.6-rc.2",
		]);
	});

	test("never lists newer versions, compared numerically", () => {
		const stale = findStaleExtensionFolders(folders, "0.6.7");
		expect(stale).not.toContain("beskid.beskid-vscode-0.6.10");
		expect(stale).not.toContain("beskid.beskid-vscode-0.7.0-darwin-arm64");
		expect(stale).not.toContain("beskid-lang.beskid-vscode-0.7.0");
	});

	test("keeps a prerelease of the running X.Y.Z and deletes nothing for an unparsable running version", () => {
		expect(findStaleExtensionFolders(folders, "0.6.7")).not.toContain("beskid.beskid-vscode-0.6.7-rc.1");
		expect(findStaleExtensionFolders(folders, "dev")).toEqual([]);
	});

	test("compareReleaseVersions", () => {
		expect(compareReleaseVersions("0.6.10", "0.6.9")).toBe(1);
		expect(compareReleaseVersions("0.6.9", "0.6.10")).toBe(-1);
		expect(compareReleaseVersions("1.0.0", "1.0.0")).toBe(0);
		expect(compareReleaseVersions("1.0.0-rc.1", "1.0.0")).toBeUndefined();
		expect(compareReleaseVersions("0.9.0-rc.1", "1.0.0")).toBe(-1);
		expect(compareReleaseVersions("x", "1.0.0")).toBeUndefined();
	});

	test("an unreadable directory yields nothing", () => {
		expect(
			listStaleExtensionFolders("/nope", "0.6.7", () => {
				throw new Error("ENOENT");
			}),
		).toEqual([]);
	});
});

describe("removal plan", () => {
	test("lists the paths and removes exactly them", () => {
		const plan = planStaleRemoval(
			{ source: "bundled", stale: { dir: "/h/.beskid/bin", files: ["/h/.beskid/bin/beskid"], found: undefined } },
			"/h/.vscode/extensions",
			"0.6.7",
		);
		expect(plan.files).toEqual(["/h/.beskid/bin/beskid"]);
		expect(plan.folders).toEqual([]);

		const withFolders = {
			files: plan.files,
			folders: [join("/h/.vscode/extensions", "beskid.beskid-vscode-0.6.6")],
		};
		const text = describeRemovalPlan(withFolders);
		expect(text).toContain("/h/.beskid/bin/beskid");
		expect(text).toContain("beskid.beskid-vscode-0.6.6");

		const removed: string[] = [];
		applyRemovalPlan(withFolders, (p) => removed.push(p));
		expect(removed).toEqual([...withFolders.files, ...withFolders.folders]);
	});
});
