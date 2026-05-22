import type { LanguageClient } from "vscode-languageclient/node";
import type {
  ListWorkspacesResult,
  ProjectDependenciesResult,
  ProjectGraphResult,
  WorkspaceListEntry,
  WorkspaceSummaryResult,
} from "./lspProjectTypes.js";

async function execute<T>(
  client: LanguageClient | undefined,
  command: string,
  args: unknown[],
): Promise<T | undefined> {
  if (!client) {
    return undefined;
  }
  try {
    return (await client.sendRequest("workspace/executeCommand", { command, arguments: args })) as T;
  } catch {
    return undefined;
  }
}

function mapDependencies(raw: {
  declared?: Array<Record<string, unknown>>;
  locked?: Array<Record<string, unknown>>;
  unresolved?: Array<Record<string, unknown> | string>;
}): ProjectDependenciesResult {
  const declared = (raw.declared ?? []).map((d) => ({
    name: String(d.name ?? ""),
    version: (d.version as string | undefined) ?? undefined,
    source: (d.source as string | undefined) ?? undefined,
    registry: (d.registry as string | undefined) ?? undefined,
  }));
  const locked = (raw.locked ?? []).map((d) => ({
    name: String(d.name ?? ""),
    version:
      (d.resolvedVersion as string | undefined) ?? (d.version as string | undefined) ?? undefined,
    source: (d.source as string | undefined) ?? undefined,
    registry: (d.registry as string | undefined) ?? undefined,
    materializedPath:
      (d.materializedRoot as string | undefined) ??
      (d.materializedPath as string | undefined),
  }));
  const unresolved = (raw.unresolved ?? []).map((u) =>
    typeof u === "string" ? u : String((u as { dependencyName?: string }).dependencyName ?? u),
  );
  return { declared, locked, unresolved };
}

export class LspProjectApi {
  constructor(private readonly getClient: () => LanguageClient | undefined) {}

  async listWorkspaces(): Promise<WorkspaceListEntry[]> {
    const result = await execute<ListWorkspacesResult>(
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
    const raw = await execute<{
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

  async getProjectGraph(projectUri: string): Promise<ProjectGraphResult | undefined> {
    const raw = await execute<{
      nodes?: Array<Record<string, unknown>>;
      edges?: Array<{ from: string; to: string }>;
      unresolved?: Array<{ dependencyName: string; descriptor?: string }>;
    }>(this.getClient(), "beskid.getProjectGraph", [projectUri]);
    if (!raw) {
      return undefined;
    }
    return {
      nodes: (raw.nodes ?? []).map((n, i) => {
        const kind = String(n.kind ?? "");
        const dependencyName = n.dependencyName as string | undefined;
        const projectName = n.projectName as string | undefined;
        return {
          id: String(n.id ?? i),
          label: dependencyName ?? projectName ?? kind,
          kind,
          uri: (n.manifestUri as string | undefined) ?? undefined,
          dependencyName,
          projectName,
          sourceRoot: n.sourceRoot as string | undefined,
          unresolved: kind === "registry" || kind === "git",
        };
      }),
      edges: raw.edges ?? [],
      unresolved: (raw.unresolved ?? []).map(
        (u) => u.descriptor ?? u.dependencyName ?? "unresolved",
      ),
    };
  }

  async getProjectDependencies(projectUri: string): Promise<ProjectDependenciesResult | undefined> {
    const raw = await execute<Record<string, unknown>>(
      this.getClient(),
      "beskid.getProjectDependencies",
      [projectUri],
    );
    if (!raw) {
      return undefined;
    }
    return mapDependencies(raw);
  }
}

export type { WorkspaceListEntry } from "./lspProjectTypes.js";
