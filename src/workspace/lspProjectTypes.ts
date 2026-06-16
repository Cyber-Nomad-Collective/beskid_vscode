/** Normative LSP executeCommand payloads (workspace/project explorer). */

export type { GraphKindId, GraphPayload, GraphNodeSummary } from "../graphs/lspGraphTypes.js";

export type WorkspaceMember = {
  name: string;
  /** BSOL member directory path relative to workspace root. */
  path: string;
  /** Canonical `file://` URI of the member `.bproj` when resolvable. */
  uri?: string | null;
  /** BSOL workspace member identifier. */
  memberId?: string;
};

export type WorkspaceListEntry = {
  uri: string;
  name: string;
  members: WorkspaceMember[];
};

export type ListWorkspacesResult = {
  workspaces: WorkspaceListEntry[];
};

export type ListWorkspacesOutcome = {
  workspaces: WorkspaceListEntry[];
  error?: string;
};

export type WorkspaceSummaryResult = {
  workspaceUri: string;
  members: WorkspaceMember[];
  registries: Record<string, string>;
};

export type ProjectGraphNode = {
  id: string;
  label: string;
  kind?: string;
  uri?: string;
  unresolved?: boolean;
};

export type ProjectDependencyEntry = {
  name: string;
  version?: string;
  source?: string;
  registry?: string;
  materializedPath?: string;
};

export type ProjectDependenciesResult = {
  declared: ProjectDependencyEntry[];
  locked: ProjectDependencyEntry[];
  unresolved: string[];
};
