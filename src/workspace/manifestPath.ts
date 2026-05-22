import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Walk parent directories from `filePath` to find the nearest existing `Project.proj`. */
export function discoverProjectFileFromPath(filePath: string): string | undefined {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.endsWith("/Project.proj") || normalized.endsWith("Project.proj")) {
    return normalized;
  }
  let dir = dirname(normalized);
  while (dir && dir !== dirname(dir)) {
    const candidate = join(dir, "Project.proj");
    if (existsSync(candidate)) {
      return candidate.replaceAll("\\", "/");
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}
