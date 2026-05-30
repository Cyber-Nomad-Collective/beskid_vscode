import type { LanguageClient } from "vscode-languageclient/node";
import { lspExecuteCommand } from "../lsp/lspExecuteCommand.js";
import type { GraphKindId, GraphPayload } from "../graphs/lspGraphTypes.js";
import type {
  ListWorkspacesResult,
  ProjectDependenciesResult,
  WorkspaceListEntry,
  WorkspaceSummaryResult,
} from "./lspProjectTypes.js";
import { mapLspProjectDependencies } from "./lspProjectMapping.js";

export class LspProjectApi {
  constructor(private readonly getClient: () => LanguageClient | undefined) {}

  async listWorkspaces(): Promise<WorkspaceListEntry[]> {
    const result = await lspExecuteCommand<ListWorkspacesResult>(
      this.getClient(),
      "beskid.listWorkspaces",
      [],
    );
    const workspaces = result?.workspaces ?? [];
    return workspaces.map((ws) => ({
      uri: ws.uri,
      name: ws.name,
      members: (ws.members ?? []).map((m) => ({
        uri: m.uri ?? "",
        name: m.name,
        path: (m as { path?: string }).path ?? m.name,
        memberId: (m as { id?: string; memberId?: string }).id ?? (m as { memberId?: string }).memberId,
      })),
    }));
  }

  async getWorkspaceSummary(workspaceUri: string): Promise<WorkspaceSummaryResult | undefined> {
    const raw = await lspExecuteCommand<{
      workspaceUri: string;
      members?: Array<{ name: string; path: string; uri?: string }>;
      registries?: Array<{ name: string; url: string; alias?: string }>;
    }>(this.getClient(), "beskid.getWorkspaceSummary", [workspaceUri]);
    if (!raw) {
      return undefined;
    }
    const registries: Record<string, string> = {};
    for (const r of raw.registries ?? []) {
      const key = (r as { alias?: string }).alias ?? r.name;
      registries[key] = r.url;
    }
    return {
      workspaceUri: raw.workspaceUri,
      members: (raw.members ?? []).map((m) => ({
        uri: m.uri ?? "",
        name: m.name,
        path: m.path ?? m.name,
        memberId: m.name,
      })),
      registries,
    };
  }

  async getGraph(
    projectUri: string,
    kind: GraphKindId = "projectDeps",
    options?: { entryUri?: string; workspaceUri?: string },
  ): Promise<GraphPayload | undefined> {
    const raw = await lspExecuteCommand<GraphPayload>(this.getClient(), "beskid.getGraph", [
      {
        projectUri,
        kind,
        entryUri: options?.entryUri,
        workspaceUri: options?.workspaceUri,
      },
    ]);
    return raw ?? undefined;
  }

  async getProjectDependencies(projectUri: string): Promise<ProjectDependenciesResult | undefined> {
    const raw = await lspExecuteCommand<Record<string, unknown>>(
      this.getClient(),
      "beskid.getProjectDependencies",
      [projectUri],
    );
    if (!raw) {
      return undefined;
    }
    return mapLspProjectDependencies(raw);
  }
}

export type { WorkspaceListEntry } from "./lspProjectTypes.js";
