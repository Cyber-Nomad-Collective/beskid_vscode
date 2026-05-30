import { dirname } from "node:path";
import * as vscode from "vscode";
import type { LspProjectApi } from "./lspProjectApi.js";
import type { GraphNodeSummary } from "../graphs/lspGraphTypes.js";
import { themeIcon } from "./tree/treeItemHelpers.js";
import { ProjectsTreeItem } from "./ProjectsTreeItem.js";

const DEPENDENCY_KINDS = new Set(["path", "git", "registry"]);

async function projectDepsNodes(
  lspApi: LspProjectApi,
  projectUri: string,
): Promise<GraphNodeSummary[]> {
  const payload = await lspApi.getGraph(projectUri, "projectDeps");
  return payload?.metadata.nodes ?? [];
}

function unresolvedLabels(
  nodes: GraphNodeSummary[],
  warnings: Array<{ code: string; message: string }> = [],
): string[] {
  const labels = warnings
    .filter((warning) => warning.code === "unresolved")
    .map((warning) => warning.message);
  for (const node of nodes) {
    if (node.unresolved) {
      labels.push(node.label);
    }
  }
  return [...new Set(labels)];
}

export async function projectSectionItems(
  _lspApi: LspProjectApi,
  projectUri: string,
): Promise<ProjectsTreeItem[]> {
  const targets = new ProjectsTreeItem(
    "section",
    "Targets",
    vscode.TreeItemCollapsibleState.Collapsed,
    projectUri,
    "targets",
  );
  targets.iconPath = themeIcon("symbol-method");

  const deps = new ProjectsTreeItem(
    "section",
    "Dependencies",
    vscode.TreeItemCollapsibleState.Collapsed,
    projectUri,
    "dependencies",
  );
  deps.iconPath = themeIcon("package");

  const sources = new ProjectsTreeItem(
    "section",
    "Source folders",
    vscode.TreeItemCollapsibleState.Collapsed,
    projectUri,
    "sources",
  );
  sources.iconPath = themeIcon("folder");

  return [targets, deps, sources];
}

export async function projectSectionChildren(
  lspApi: LspProjectApi,
  projectUri: string,
  section: "targets" | "dependencies" | "sources",
): Promise<ProjectsTreeItem[]> {
  const focused = vscode.Uri.parse(projectUri);

  if (section === "targets") {
    const nodes = await projectDepsNodes(lspApi, projectUri);
    const rootNode = nodes.find((node) => node.kind === "root");
    const label = rootNode ? `${rootNode.label} (${rootNode.kind})` : "Project";
    const item = new ProjectsTreeItem(
      "target",
      label,
      vscode.TreeItemCollapsibleState.None,
      projectUri,
    );
    item.iconPath = themeIcon("symbol-method");
    return [item];
  }

  if (section === "dependencies") {
    const payload = await lspApi.getGraph(projectUri, "projectDeps");
    const nodes = payload?.metadata.nodes ?? [];
    const items: ProjectsTreeItem[] = [];
    for (const node of nodes) {
      if (node.kind === "root" || !DEPENDENCY_KINDS.has(node.kind)) {
        continue;
      }
      const item = new ProjectsTreeItem(
        "dep",
        node.label,
        vscode.TreeItemCollapsibleState.None,
        projectUri,
        undefined,
        node.unresolved,
      );
      item.description = node.kind;
      item.iconPath = node.unresolved ? themeIcon("warning") : themeIcon("package");
      if (node.uri) {
        item.resourceUri = vscode.Uri.parse(node.uri);
      }
      items.push(item);
    }
    for (const label of unresolvedLabels(nodes, payload?.warnings)) {
      const item = new ProjectsTreeItem(
        "dep",
        label,
        vscode.TreeItemCollapsibleState.None,
        projectUri,
        undefined,
        true,
      );
      item.description = "unresolved";
      item.iconPath = themeIcon("warning");
      items.push(item);
    }
    if (items.length === 0) {
      const data = await lspApi.getProjectDependencies(projectUri);
      for (const dep of data?.declared ?? []) {
        const label = dep.version ? `${dep.name}@${dep.version}` : dep.name;
        items.push(
          new ProjectsTreeItem("dep", label, vscode.TreeItemCollapsibleState.None, projectUri),
        );
      }
    }
    return items;
  }

  const roots = new Set<string>();
  const rootDir = dirname(focused.fsPath);
  const pattern = new vscode.RelativePattern(rootDir, "**/*.bd");
  const files = await vscode.workspace.findFiles(pattern, "**/target/**", 40);
  for (const file of files) {
    roots.add(dirname(file.fsPath));
  }
  return [...roots].sort().map((dir) => {
    const item = new ProjectsTreeItem(
      "folder",
      vscode.workspace.asRelativePath(vscode.Uri.file(dir)),
      vscode.TreeItemCollapsibleState.None,
      projectUri,
    );
    item.resourceUri = vscode.Uri.file(dir);
    item.iconPath = themeIcon("folder");
    return item;
  });
}
