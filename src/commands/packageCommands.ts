import * as vscode from "vscode";
import type { ExtensionContext } from "vscode";
import { writePckgApiKey } from "../packages/pckgClient.js";
import type { PackageTreeItem } from "../packages/PackageTreeItem.js";
import type { PackageManagerProvider } from "../packages/PackageManagerProvider.js";
import type { RefreshCoordinator } from "../core/RefreshCoordinator.js";

function payloadFromItem(item: unknown): Record<string, unknown> | undefined {
  if (item && typeof item === "object" && "payload" in item) {
    return (item as PackageTreeItem).payload;
  }
  return undefined;
}

export function registerPackageCommands(
  context: ExtensionContext,
  deps: {
    packageProvider: PackageManagerProvider;
    refresh: RefreshCoordinator;
  },
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("beskid.packages.open", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.beskidViews");
    }),
    vscode.commands.registerCommand("beskid.packages.search", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search packages",
        placeHolder: "package name or category…",
      });
      if (query !== undefined) {
        deps.packageProvider.setQuery(query);
      }
    }),
    vscode.commands.registerCommand("beskid.packages.showDetails", (name?: unknown) => {
      const pkg = typeof name === "string" ? name : undefined;
      if (pkg) {
        return deps.packageProvider.showDetailsForPackage(pkg);
      }
    }),
    vscode.commands.registerCommand("beskid.packages.addDependency", () =>
      deps.packageProvider.addDependency(),
    ),
    vscode.commands.registerCommand("beskid.packages.refresh", async () => {
      deps.packageProvider.clearCaches();
      await deps.refresh.scheduleFull();
      deps.packageProvider.refresh();
    }),
    vscode.commands.registerCommand("beskid.packages.configureApiKey", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Package registry API key (Bearer)",
        password: true,
        ignoreFocusOut: true,
      });
      if (key === undefined) {
        return;
      }
      await writePckgApiKey(context, key.length > 0 ? key : undefined);
      deps.packageProvider.clearCaches();
      deps.packageProvider.refresh();
    }),
    vscode.commands.registerCommand("beskid.packages.openManifest", async (item?: unknown) => {
      const payload = payloadFromItem(item);
      const uri = payload?.projectUri as string | undefined;
      if (uri) {
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(uri));
      }
    }),
    vscode.commands.registerCommand(
      "beskid.packages.openMaterializedFolder",
      async (item?: unknown) => {
        const payload = payloadFromItem(item);
        const p = (payload?.materializedPath as string | undefined)?.trim();
        if (p) {
          const folder = vscode.Uri.file(p);
          if (typeof vscode.commands.executeCommand === "function") {
            try {
              await vscode.commands.executeCommand("revealInExplorer", folder);
            } catch {
              await vscode.commands.executeCommand("vscode.open", folder);
            }
          }
        }
      },
    ),
    vscode.commands.registerCommand("beskid.packages.copyDependencyLabel", async (item?: unknown) => {
      const payload = payloadFromItem(item);
      const label = (payload?.label as string | undefined) ?? (typeof item === "object" && item && "label" in item ? String((item as PackageTreeItem).label) : undefined);
      if (label) {
        await vscode.env.clipboard.writeText(label);
      }
    }),
    vscode.commands.registerCommand("beskid.packages.openRegistryUri", async (uri: unknown) => {
      if (typeof uri !== "string" || (!uri.startsWith("http://") && !uri.startsWith("https://"))) {
        return;
      }
      await vscode.env.openExternal(vscode.Uri.parse(uri));
    }),
  );
}
