/** Tree views declared under `contributes.views.beskidViews`. */
export const BESKID_TREE_VIEW_IDS = [
  "beskidProjectsView",
  "beskidProjectOutlineView",
  "beskidPackagesView",
] as const;

/** @deprecated Use `beskidProjectsView`. Kept for command/menu migration. */
export const LEGACY_PROJECT_VIEW_IDS = ["beskidWorkspaceView", "beskidProjectView"] as const;

export const BESKID_OPTIONAL_TREE_VIEW_IDS = ["beskidDebugView"] as const;

export type BeskidTreeViewId =
  | (typeof BESKID_TREE_VIEW_IDS)[number]
  | (typeof BESKID_OPTIONAL_TREE_VIEW_IDS)[number];

export const BESKID_SIDEBAR_VIEW_IDS = [
  ...BESKID_TREE_VIEW_IDS,
  ...BESKID_OPTIONAL_TREE_VIEW_IDS,
] as const;

export const BESKID_VIEWS_CONTAINER_ID = "beskidViews";
