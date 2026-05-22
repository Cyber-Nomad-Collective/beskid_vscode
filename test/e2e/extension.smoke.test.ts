import { describe, expect, test } from "bun:test";
import pkg from "../../package.json";

const VIEW_IDS = [
  "beskidWorkspaceView",
  "beskidProjectView",
  "beskidProjectOutlineView",
  "beskidPackagesView",
];

describe("extension manifest smoke", () => {
  test("contributes four Beskid tree views", () => {
    const views = pkg.contributes.views.beskidViews as { id: string }[];
    expect(views.map((v) => v.id)).toEqual(VIEW_IDS);
  });

  test("declares package panel and explorer commands", () => {
    const ids = (pkg.contributes.commands as { command: string }[]).map((c) => c.command);
    expect(ids).toContain("beskid.packages.configureApiKey");
    expect(ids).toContain("beskid.packages.openManifest");
    expect(ids).toContain("beskid.revealInProjectTree");
    expect(ids).toContain("beskid.packages.fetch");
    expect(ids).toContain("beskid.cli.fetch");
  });

  test("local dependency context menu entries", () => {
    const menus = pkg.contributes.menus["view/item/context"] as { command: string; when?: string }[];
    const localMenus = menus.filter((m) => m.when?.includes("beskidLocalDependency"));
    expect(localMenus.length).toBeGreaterThanOrEqual(3);
  });
});
