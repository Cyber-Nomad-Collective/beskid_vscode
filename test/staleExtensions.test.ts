import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
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
	"ms-python.python-2024.1.0",
	"someone.beskid-vscode-fork-1.0.0",
];

describe("findStaleExtensionFolders", () => {
	test("lists other versions and the old publisher id, never the running one", () => {
		expect(findStaleExtensionFolders(folders, "0.6.7")).toEqual([
			"beskid-lang.beskid-vscode-0.5.2-darwin-arm64",
			"beskid-lang.beskid-vscode-0.6.7",
			"beskid.beskid-vscode-0.4.0",
			"beskid.beskid-vscode-0.5.2",
			"beskid.beskid-vscode-0.6.6",
		]);
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
