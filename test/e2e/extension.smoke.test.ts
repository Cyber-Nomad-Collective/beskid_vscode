import { describe, expect, test } from "bun:test";
import pkg from "../../package.json";
import { BESKID_SIDEBAR_VIEW_IDS } from "../../src/views/beskidViewIds.js";

describe("extension manifest smoke", () => {
  test("contributes Beskid sidebar views including dashboard and debug", () => {
    const views = pkg.contributes.views.beskidViews as { id: string; type?: string }[];
    expect(views.map((view) => view.id)).toEqual([...BESKID_SIDEBAR_VIEW_IDS]);
    const dashboard = views.find((view) => view.id === "beskidDashboardView");
    expect(dashboard?.type).toBe("webview");
  });

  test("declares package panel and explorer commands", () => {
    const ids = (pkg.contributes.commands as { command: string }[]).map((command) => command.command);
    expect(ids).toContain("beskid.packages.configureApiKey");
    expect(ids).toContain("beskid.packages.openManifest");
    expect(ids).toContain("beskid.revealInProjectTree");
    expect(ids).toContain("beskid.packages.fetch");
    expect(ids).toContain("beskid.cli.fetch");
    expect(ids).toContain("beskid.debug.focus");
  });

  test("local dependency context menu entries", () => {
    const menus = pkg.contributes.menus["view/item/context"] as { command: string; when?: string }[];
    const localMenus = menus.filter((menu) => menu.when?.includes("beskidLocalDependency"));
    expect(localMenus.length).toBeGreaterThanOrEqual(3);
  });
});
