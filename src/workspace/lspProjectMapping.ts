import type { ProjectDependenciesResult } from "./lspProjectTypes.js";

/** Map raw LSP `getProjectDependencies` JSON into extension tree models. */
export function mapLspProjectDependencies(raw: {
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
