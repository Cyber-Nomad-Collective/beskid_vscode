import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const PROJECT_MANIFEST_EXTENSION = ".bproj";
const WORKSPACE_MANIFEST_EXTENSION = ".bws";

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function isProjectManifestPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(PROJECT_MANIFEST_EXTENSION);
}

function isWorkspaceManifestPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(WORKSPACE_MANIFEST_EXTENSION);
}

function discoverProjectManifestInDir(dir: string): string | undefined {
  let matches: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(PROJECT_MANIFEST_EXTENSION)) {
        matches.push(join(dir, entry.name));
      }
    }
  } catch {
    return undefined;
  }
  matches.sort();
  if (matches.length === 1) {
    return normalizePath(matches[0]!);
  }
  return undefined;
}

/** Walk parent directories from `filePath` to find the nearest single `*.bproj` manifest. */
export function discoverProjectFileFromPath(filePath: string): string | undefined {
  const normalized = normalizePath(filePath);
  if (isProjectManifestPath(normalized) || isWorkspaceManifestPath(normalized)) {
    return normalized;
  }
  let dir = dirname(normalized);
  while (dir && dir !== dirname(dir)) {
    const candidate = discoverProjectManifestInDir(dir);
    if (candidate) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

export function isProjectManifestUri(uri: string): boolean {
  return isProjectManifestPath(normalizePath(uri));
}

export function isWorkspaceManifestUri(uri: string): boolean {
  return isWorkspaceManifestPath(normalizePath(uri));
}

export function isManifestUri(uri: string): boolean {
  return isProjectManifestUri(uri) || isWorkspaceManifestUri(uri);
}

/** Discover a single `.bws` in `dir`, if present. */
export function discoverWorkspaceManifestInDir(dir: string): string | undefined {
  let matches: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(WORKSPACE_MANIFEST_EXTENSION)) {
        matches.push(join(dir, entry.name));
      }
    }
  } catch {
    return undefined;
  }
  matches.sort();
  if (matches.length === 1) {
    return normalizePath(matches[0]!);
  }
  return undefined;
}

/** Prefer `.bws` in `dir`, else exactly one `.bproj`. */
export function discoverManifestInDir(dir: string): string | undefined {
  const workspace = discoverWorkspaceManifestInDir(dir);
  if (workspace) {
    return workspace;
  }
  return discoverProjectManifestInDir(dir);
}

/** Returns true when `filePath` points at an existing manifest file. */
export function manifestExists(filePath: string): boolean {
  return existsSync(filePath);
}
