import { existsSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { discoverProjectFileFromPath } from "../workspace/manifestPath.js";

/** Manifest paths to run `beskid fetch` against on first toolchain bootstrap. */
export async function discoverBootstrapProjects(): Promise<vscode.Uri[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return [];
  }

  const manifests = new Set<string>();

  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const workspaceProj = join(root, "Workspace.proj");
    if (existsSync(workspaceProj)) {
      manifests.add(workspaceProj);
      continue;
    }
    const projectProj = join(root, "Project.proj");
    if (existsSync(projectProj)) {
      manifests.add(projectProj);
      continue;
    }
    const discovered = discoverProjectFileFromPath(join(root, "placeholder.bd"));
    if (discovered) {
      manifests.add(discovered);
    }
  }

  return [...manifests].map((path) => vscode.Uri.file(path));
}
