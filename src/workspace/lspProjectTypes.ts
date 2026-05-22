/** Normative LSP executeCommand payloads (workspace/project explorer). */

export type WorkspaceMember = {
  name: string;
  path?: string;
  uri?: string | null;
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
  dependencyName?: string;
  projectName?: string;
  sourceRoot?: string;
  unresolved?: boolean;
};

export type ProjectGraphEdge = {
  from: string;
  to: string;
};

export type ProjectGraphResult = {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  unresolved: string[];
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
