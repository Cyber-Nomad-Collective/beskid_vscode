import { describe, expect, test } from "bun:test";
import bsolConfiguration from "../../beskid-proj-language-configuration.json";
import pkg from "../../package.json";
import {
	BESKID_SIDEBAR_VIEW_IDS,
	BESKID_TREE_VIEW_IDS,
} from "../../src/views/beskidViewIds.js";

describe("extension manifest smoke", () => {
	test("registers standalone BSOL through the same syntax adapter and semantic layer as manifests", () => {
		const languages = pkg.contributes.languages as {
			id: string;
			extensions?: string[];
			configuration?: string;
		}[];
		const bsolLanguage = languages.find((language) => language.id === "bsol");
		const manifestLanguage = languages.find(
			(language) => language.id === "beskid-manifest",
		);

		expect(bsolLanguage).toEqual(
			expect.objectContaining({
				id: "bsol",
				aliases: ["Beskid BSOL", "bsol"],
				extensions: [".bsol"],
				configuration: "./beskid-proj-language-configuration.json",
			}),
		);
		expect(bsolLanguage?.configuration).toBe(manifestLanguage?.configuration);
		expect(bsolConfiguration.comments).toEqual({ lineComment: "#" });

		const grammars = pkg.contributes.grammars as {
			language: string;
			scopeName: string;
			path: string;
		}[];
		const bsolGrammar = grammars.find((grammar) => grammar.language === "bsol");
		const manifestGrammar = grammars.find(
			(grammar) => grammar.language === "beskid-manifest",
		);
		expect(bsolGrammar).toEqual(
			expect.objectContaining({
				language: "bsol",
				scopeName: "source.beskid.proj",
				path: "./syntaxes/beskid-proj.tmLanguage.json",
			}),
		);
		expect(bsolGrammar?.scopeName).toBe(manifestGrammar?.scopeName);
		expect(bsolGrammar?.path).toBe(manifestGrammar?.path);

		const defaults = pkg.contributes.configurationDefaults as Record<
			string,
			Record<string, unknown>
		>;
		for (const language of ["[beskid-manifest]", "[bsol]"]) {
			expect(defaults[language]?.["editor.semanticHighlighting.enabled"]).toBe(
				true,
			);
			expect(defaults[language]?.["editor.defaultFormatter"]).toBeUndefined();
			expect(defaults[language]?.["editor.formatOnSave"]).toBeUndefined();
		}
	});

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
