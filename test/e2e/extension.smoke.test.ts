import { describe, expect, test } from "bun:test";
import pkg from "../../package.json";
import {
	BESKID_SIDEBAR_VIEW_IDS,
	BESKID_TREE_VIEW_IDS,
} from "../../src/views/beskidViewIds.js";

describe("extension manifest smoke", () => {
	test("contributes Beskid sidebar tree views without dashboard webview", () => {
		const views = pkg.contributes.views.beskidViews as {
			id: string;
			type?: string;
		}[];
		expect(views.map((view) => view.id)).toEqual([...BESKID_SIDEBAR_VIEW_IDS]);
		expect(views.some((view) => view.type === "webview")).toBe(false);
		for (const viewId of BESKID_TREE_VIEW_IDS) {
			expect(views.some((view) => view.id === viewId)).toBe(true);
		}
	});

	test("declares status dashboard in bottom panel webview", () => {
		const panelViews = pkg.contributes.views.beskidPanel as {
			id: string;
			type?: string;
			name?: string;
		}[];
		expect(panelViews).toEqual([
			expect.objectContaining({
				id: "beskidDashboardView",
				type: "webview",
				name: "Status",
			}),
		]);
		const panelContainers = pkg.contributes.viewsContainers.panel as {
			id: string;
			title?: string;
		}[];
		expect(
			panelContainers.some((container) => container.id === "beskidPanel"),
		).toBe(true);
	});

	test("declares package panel and explorer commands", () => {
		const ids = (pkg.contributes.commands as { command: string }[]).map(
			(command) => command.command,
		);
		expect(ids).toContain("beskid.packages.configureApiKey");
		expect(ids).toContain("beskid.packages.openManifest");
		expect(ids).toContain("beskid.revealInProjectTree");
		expect(ids).toContain("beskid.packages.fetch");
		expect(ids).toContain("beskid.cli.fetch");
		expect(ids).toContain("beskid.modal.open");
		expect(ids).toContain("beskid.openSymbolDocumentation");
		expect(ids).toContain("beskid.showGraph");
	});

	test("local dependency context menu entries", () => {
		const menus = pkg.contributes.menus["view/item/context"] as {
			command: string;
			when?: string;
		}[];
		const localMenus = menus.filter((menu) =>
			menu.when?.includes("beskidLocalDependency"),
		);
		expect(localMenus.length).toBeGreaterThanOrEqual(3);
	});
});
