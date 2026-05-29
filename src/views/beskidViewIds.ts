/** Tree views declared under `contributes.views.beskidViews` (excluding webviews). */
export const BESKID_TREE_VIEW_IDS = [
  "beskidDebugView",
  "beskidWorkspaceView",
  "beskidProjectView",
  "beskidProjectOutlineView",
  "beskidPackagesView",
] as const;

export type BeskidTreeViewId = (typeof BESKID_TREE_VIEW_IDS)[number];

/** Webview views in the Beskid activity bar container. */
export const BESKID_WEBVIEW_VIEW_IDS = ["beskidDashboardView"] as const;

export type BeskidWebviewViewId = (typeof BESKID_WEBVIEW_VIEW_IDS)[number];

export const BESKID_SIDEBAR_VIEW_IDS = [
  ...BESKID_WEBVIEW_VIEW_IDS,
  ...BESKID_TREE_VIEW_IDS,
] as const;

export const BESKID_VIEWS_CONTAINER_ID = "beskidViews";
