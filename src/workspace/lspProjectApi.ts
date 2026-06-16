import type * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { fromLspCommandResult } from "../lsp/lspBoundary.js";
import type { LspOutcome } from "../lsp/lspBoundary.js";
import { lspExecuteCommand } from "../lsp/lspExecuteCommand.js";
import type { GraphKindId, GraphPayload } from "../graphs/lspGraphTypes.js";
import type {
  ListWorkspacesOutcome,
  ListWorkspacesResult,
  ProjectDependenciesResult,
  WorkspaceListEntry,
  WorkspaceMember,
  WorkspaceSummaryResult,
} from "./lspProjectTypes.js";
import { mapLspProjectDependencies } from "./lspProjectMapping.js";

type RawWorkspaceMember = {
  name: string;
  path?: string;
  uri?: string | null;
  memberId?: string;
};

type RawWorkspaceListEntry = {
  uri: string;
  name: string;
  members?: RawWorkspaceMember[];
};

function mapWorkspaceMember(member: RawWorkspaceMember): WorkspaceMember {
  return {
    name: member.name,
    path: member.path ?? member.name,
    uri: member.uri ?? undefined,
    memberId: member.memberId ?? member.path ?? member.name,
  };
}

function mapWorkspaceEntry(ws: RawWorkspaceListEntry): WorkspaceListEntry {
  return {
    uri: ws.uri,
    name: ws.name,
    members: (ws.members ?? []).map(mapWorkspaceMember),
  };
}

export class LspProjectApi {
  constructor(
    private readonly getClient: () => LanguageClient | undefined,
    private readonly outputChannel?: vscode.OutputChannel,
  ) {}

  async listWorkspaces(): Promise<ListWorkspacesOutcome> {
    const outcome = await this.execute<ListWorkspacesResult>("beskid.listWorkspaces", []);
    if (!outcome.ok) {
      return { workspaces: [], error: outcome.error };
    }
    return {
      workspaces: (outcome.value.workspaces ?? []).map(mapWorkspaceEntry),
    };
  }

  async getWorkspaceSummary(workspaceUri: string): Promise<LspOutcome<WorkspaceSummaryResult>> {
    const outcome = await this.execute<{
      workspaceUri: string;
      members?: RawWorkspaceMember[];
      registries?: Array<{ name: string; url: string; alias?: string }>;
    }>("beskid.getWorkspaceSummary", [workspaceUri]);
    if (!outcome.ok) {
      return outcome;
    }
    const raw = outcome.value;
    const registries: Record<string, string> = {};
    for (const registry of raw.registries ?? []) {
      const key = registry.alias ?? registry.name;
      registries[key] = registry.url;
    }
    return {
      ok: true,
      value: {
        workspaceUri: raw.workspaceUri,
        members: (raw.members ?? []).map(mapWorkspaceMember),
        registries,
      },
    };
  }

  async getGraph(
    projectUri: string,
    kind: GraphKindId = "projectDeps",
    options?: { entryUri?: string; workspaceUri?: string },
  ): Promise<LspOutcome<GraphPayload>> {
    return this.execute("beskid.getGraph", [
      {
        projectUri,
        kind,
        entryUri: options?.entryUri,
        workspaceUri: options?.workspaceUri,
      },
    ]);
  }

  async getProjectDependencies(projectUri: string): Promise<LspOutcome<ProjectDependenciesResult>> {
    const outcome = await this.execute<Record<string, unknown>>(
      "beskid.getProjectDependencies",
      [projectUri],
    );
    if (!outcome.ok) {
      return outcome;
    }
    return { ok: true, value: mapLspProjectDependencies(outcome.value) };
  }

  private async execute<T>(command: string, args: unknown[]): Promise<LspOutcome<T>> {
    const result = await lspExecuteCommand<T>(
      this.getClient(),
      command,
      args,
      this.outputChannel,
    );
    return fromLspCommandResult(result);
  }
}

export type { WorkspaceListEntry } from "./lspProjectTypes.js";
