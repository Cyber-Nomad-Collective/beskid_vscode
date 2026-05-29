import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";
import {
  BESKID_SIDEBAR_VIEW_IDS,
  BESKID_TREE_VIEW_IDS,
  BESKID_VIEWS_CONTAINER_ID,
  BESKID_WEBVIEW_VIEW_IDS,
} from "../src/views/beskidViewIds.js";

describe("views manifest contract", () => {
  test("declares Beskid activity bar container", () => {
    const containers = pkg.contributes.viewsContainers.activitybar as { id: string }[];
    expect(containers.some((c) => c.id === BESKID_VIEWS_CONTAINER_ID)).toBe(true);
  });

  test("sidebar view ids match constants", () => {
    const views = pkg.contributes.views[BESKID_VIEWS_CONTAINER_ID] as { id: string; type?: string }[];
    expect(views.map((view) => view.id)).toEqual([...BESKID_SIDEBAR_VIEW_IDS]);
  });

  test("tree and webview ids partition sidebar views", () => {
    expect([...BESKID_WEBVIEW_VIEW_IDS, ...BESKID_TREE_VIEW_IDS]).toEqual([
      ...BESKID_SIDEBAR_VIEW_IDS,
    ]);
  });

  test("dashboard is the only webview view", () => {
    const views = pkg.contributes.views[BESKID_VIEWS_CONTAINER_ID] as { id: string; type?: string }[];
    const webviews = views.filter((view) => view.type === "webview");
    expect(webviews.map((view) => view.id)).toEqual([...BESKID_WEBVIEW_VIEW_IDS]);
  });
});

describe("view registration source contract", () => {
  test("registerViews uses createTreeView for every tree id", () => {
    const source = readFileSync(join(import.meta.dir, "../src/activation/registerViews.ts"), "utf8");
    expect(source).toContain("createTreeView");
    expect(source).not.toContain("registerTreeDataProvider");
    for (const viewId of BESKID_TREE_VIEW_IDS) {
      expect(source).toContain(`createTreeView("${viewId}"`);
    }
  });

  test("registerRuntimeUi does not register tree views", () => {
    const source = readFileSync(join(import.meta.dir, "../src/activation/registerRuntimeUi.ts"), "utf8");
    expect(source).not.toContain("registerTreeDataProvider");
    expect(source).not.toContain("createTreeView");
  });
});

describe("activation events", () => {
  test("activates on startup for automated onboarding", () => {
    expect(pkg.activationEvents).toContain("onStartupFinished");
  });
});
