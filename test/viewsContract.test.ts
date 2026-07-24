import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";
import {
	BESKID_SIDEBAR_VIEW_IDS,
	BESKID_TREE_VIEW_IDS,
	BESKID_VIEWS_CONTAINER_ID,
} from "../src/views/beskidViewIds.js";

describe("views manifest contract", () => {
	test("declares Beskid activity bar container", () => {
		const containers = pkg.contributes.viewsContainers.activitybar as {
			id: string;
		}[];
		expect(containers.some((c) => c.id === BESKID_VIEWS_CONTAINER_ID)).toBe(true);
	});

	test("sidebar view ids match constants", () => {
		const views = pkg.contributes.views[BESKID_VIEWS_CONTAINER_ID] as {
			id: string;
			type?: string;
		}[];
		expect(views.map((view) => view.id)).toEqual([...BESKID_SIDEBAR_VIEW_IDS]);
	});

	test("does not declare removed Outline view", () => {
		const views = pkg.contributes.views[BESKID_VIEWS_CONTAINER_ID] as {
			id: string;
		}[];
		expect(views.some((view) => view.id === "beskidProjectOutlineView")).toBe(
			false,
		);
		expect([...BESKID_SIDEBAR_VIEW_IDS]).not.toContain(
			"beskidProjectOutlineView",
		);
	});

	test("no sidebar webview views", () => {
		const views = pkg.contributes.views[BESKID_VIEWS_CONTAINER_ID] as {
			id: string;
			type?: string;
		}[];
		const webviews = views.filter((view) => view.type === "webview");
		expect(webviews).toEqual([]);
	});

	test("declares status dashboard in bottom panel, not sidebar", () => {
		const panelContainer = pkg.contributes.viewsContainers.panel as {
			id: string;
		}[];
		expect(panelContainer.some((c) => c.id === "beskidPanel")).toBe(true);
		const panelViews = pkg.contributes.views.beskidPanel as {
			id: string;
			type?: string;
		}[];
		expect(panelViews).toEqual([
			expect.objectContaining({ type: "webview", id: "beskidDashboardView" }),
		]);
	});
});

describe("view registration source contract", () => {
	test("registerViews uses createTreeView for core tree ids", () => {
		const source = readFileSync(
			join(import.meta.dir, "../src/activation/registerViews.ts"),
			"utf8",
		);
		expect(source).toContain("createTreeView");
		expect(source).not.toContain("registerTreeDataProvider");
		for (const viewId of BESKID_TREE_VIEW_IDS) {
			expect(source).toContain(`createTreeView("${viewId}"`);
		}
	});

	test("registerRuntimeUi registers status dashboard webview", () => {
		const source = readFileSync(
			join(import.meta.dir, "../src/activation/registerRuntimeUi.ts"),
			"utf8",
		);
		expect(source).toContain("BeskidModalPanel");
		expect(source).not.toContain("createTreeView");
		const panelSource = readFileSync(
			join(import.meta.dir, "../src/dashboard/BeskidModalPanel.ts"),
			"utf8",
		);
		expect(panelSource).toContain("registerWebviewViewProvider");
		expect(panelSource).not.toContain("createWebviewPanel");
	});
});

describe("activation events", () => {
	test("activates on startup for automated onboarding", () => {
		expect(pkg.activationEvents).toContain("onStartupFinished");
	});
});

describe("status dashboard command", () => {
	test("registers beskid.modal.open and beskid.dashboard.focus", () => {
		const commands = pkg.contributes.commands as { command: string }[];
		expect(commands.some((c) => c.command === "beskid.modal.open")).toBe(true);
		expect(commands.some((c) => c.command === "beskid.dashboard.focus")).toBe(
			true,
		);
	});

	test("status bar entry is wired to modal open command in ExtensionServices", () => {
		const source = readFileSync(
			join(import.meta.dirname, "../src/core/ExtensionServices.ts"),
			"utf8",
		);
		expect(source).toContain('this.statusBar.command = "beskid.modal.open"');
	});
});
