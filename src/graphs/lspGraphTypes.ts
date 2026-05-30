export type GraphKindId =
  | "projectDeps"
  | "workspace"
  | "moduleTree"
  | "importClosure"
  | "hostComposition";

export interface GraphWarningPayload {
  code: string;
  message: string;
}

export interface GraphNodeSummary {
  id: string;
  label: string;
  kind: string;
  uri?: string;
  unresolved?: boolean;
}

export interface GraphPayload {
  kind: GraphKindId;
  mermaid: string;
  revision: string;
  warnings: GraphWarningPayload[];
  metadata: {
    nodes: GraphNodeSummary[];
    focusedProjectUri?: string;
  };
}
