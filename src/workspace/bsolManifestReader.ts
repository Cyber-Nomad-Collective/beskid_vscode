import { readFileSync } from "node:fs";

export type ManifestTarget = {
  name: string;
};

export type ManifestDependency = {
  name: string;
  version?: string;
  source?: string;
};

export type ProjectManifestSnapshot = {
  targets: ManifestTarget[];
  dependencies: ManifestDependency[];
};

const TARGET_BLOCK_RE = /\ntarget\s+"([^"]+)"\s*\{/g;
const DEPENDENCY_BLOCK_RE = /\ndependency\s+"([^"]+)"\s*\{([^}]*)\}/g;
const VERSION_RE = /version\s*=\s*"([^"]+)"/;

/** Degraded fallback: parse `.bproj` on disk when LSP explorer commands fail or return no data. */
export function parseBprojManifest(text: string): ProjectManifestSnapshot {
  const targets: ManifestTarget[] = [];
  for (const match of text.matchAll(TARGET_BLOCK_RE)) {
    const name = match[1]?.trim();
    if (name) {
      targets.push({ name });
    }
  }

  const dependencies: ManifestDependency[] = [];
  for (const match of text.matchAll(DEPENDENCY_BLOCK_RE)) {
    const name = match[1]?.trim();
    if (!name) {
      continue;
    }
    const body = match[2] ?? "";
    const version = VERSION_RE.exec(body)?.[1]?.trim();
    const source =
      /source\s*=\s*"?([A-Za-z_][\w]*)"?\s*/.exec(body)?.[1]?.trim() ??
      /source\s*=\s*(\w+)/.exec(body)?.[1]?.trim();
    dependencies.push({
      name,
      version: version || undefined,
      source: source || undefined,
    });
  }

  return { targets, dependencies };
}

/** Read declared targets/deps from a `.bproj` on disk (degraded mode when LSP is unavailable). */
export function readProjectManifestSnapshot(manifestPath: string): ProjectManifestSnapshot | undefined {
  try {
    const text = readFileSync(manifestPath, "utf8");
    return parseBprojManifest(text);
  } catch {
    return undefined;
  }
}
