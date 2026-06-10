import * as vscode from "vscode";
import {
  discoverManifestInDir,
  discoverProjectFileFromPath,
} from "../workspace/manifestPath.js";

/** Manifest paths to run `beskid fetch` against on first toolchain bootstrap. */
export async function discoverBootstrapProjects(): Promise<vscode.Uri[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return [];
  }

  const manifests = new Set<string>();

  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const discovered = discoverManifestInDir(root);
    if (discovered) {
      manifests.add(discovered);
      continue;
    }
    const upward = discoverProjectFileFromPath(root);
    if (upward) {
      manifests.add(upward);
    }
  }

  return [...manifests].map((path) => vscode.Uri.file(path));
}
