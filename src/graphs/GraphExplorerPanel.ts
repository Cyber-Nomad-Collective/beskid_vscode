import * as vscode from "vscode";
import type { LspProjectApi } from "../workspace/lspProjectApi.js";
import { isProjectManifestUri, isWorkspaceManifestUri } from "../workspace/manifestPath.js";
import type { GraphKindId } from "./lspGraphTypes.js";
import { renderGraphPanelHtml, type GraphPanelViewState } from "./graphPanelHtml.js";
import { WebviewPanelHost } from "../webviews/WebviewPanelHost.js";

const PANEL_TYPE = "beskidGraphExplorer";

export class GraphExplorerPanel extends WebviewPanelHost {
  private projectUri: string | undefined;
  private workspaceUri: string | undefined;
  private kind: GraphKindId = "projectDeps";
  private nodesById = new Map<string, GraphPanelViewState["nodes"][number]>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly lspApi: LspProjectApi,
    private readonly getFocusedProjectUri: () => vscode.Uri | undefined,
  ) {
    super();
  }

  async open(kind: GraphKindId = "projectDeps", projectUri?: vscode.Uri): Promise<void> {
    this.kind = kind;
    const focused = projectUri ?? this.getFocusedProjectUri();
    if (!focused) {
      void vscode.window.showWarningMessage("Focus a Beskid project first.");
      return;
    }
    if (kind === "workspace") {
      if (!isWorkspaceManifestUri(focused.fsPath)) {
        void vscode.window.showWarningMessage("Open a .bws workspace manifest for the workspace graph.");
        return;
      }
      this.workspaceUri = focused.toString();
      this.projectUri = focused.toString();
    } else if (isWorkspaceManifestUri(focused.fsPath)) {
      void vscode.window.showWarningMessage("Focus a .bproj project manifest for this graph kind.");
      return;
    } else if (isProjectManifestUri(focused.fsPath)) {
      this.projectUri = focused.toString();
    } else {
      void vscode.window.showWarningMessage("Focus a Beskid .bproj manifest first.");
      return;
    }

    if (!this.panel) {
      const panel = vscode.window.createWebviewPanel(
        PANEL_TYPE,
        "Beskid Graph",
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true },
      );
      const mediaRoot = vscode.Uri.joinPath(this.extensionUri, "media", "graph");
      this.bindPanel(panel, [mediaRoot]);
      panel.webview.onDidReceiveMessage((message: unknown) => void this.handleMessage(message));
    } else {
      this.reveal();
    }
    await this.refresh();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object" || !("type" in message)) {
      return;
    }
    const msg = message as { type: string; kind?: GraphKindId; id?: string; label?: string };
    switch (msg.type) {
      case "refresh":
        await this.refresh();
        break;
      case "setKind":
        if (msg.kind) {
          this.kind = msg.kind;
          await this.refresh();
        }
        break;
      case "nodeClick": {
        const node = msg.id ? this.nodesById.get(msg.id) : undefined;
        const uri = node?.uri;
        if (uri) {
          await vscode.window.showTextDocument(vscode.Uri.parse(uri));
        } else if (msg.label) {
          void vscode.window.showInformationMessage(`Graph node: ${msg.label}`);
        }
        break;
      }
      default:
        break;
    }
  }

  async refresh(): Promise<void> {
    if (!this.panel || !this.projectUri) {
      return;
    }
    const outcome = await this.lspApi.getGraph(this.projectUri, this.kind, {
      workspaceUri: this.workspaceUri,
    });
    if (!outcome.ok) {
      void vscode.window.showErrorMessage(`Failed to load graph from language server: ${outcome.error}`);
      return;
    }
    const payload = outcome.value;
    this.nodesById.clear();
    for (const node of payload.metadata.nodes) {
      this.nodesById.set(node.id, node);
    }
    const state: GraphPanelViewState = {
      title: `Beskid graph (${payload.kind})`,
      mermaid: payload.mermaid,
      revision: payload.revision,
      kind: payload.kind,
      warnings: payload.warnings ?? [],
      nodes: payload.metadata.nodes,
    };
    const webview = this.panel.webview;
    const mermaidUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "graph", "mermaid.min.js"),
    );
    const panelUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "graph", "panel.js"));
    this.postHtml(renderGraphPanelHtml(webview.cspSource, mermaidUri.toString(), panelUri.toString(), state));
    this.panel.title = state.title;
  }

  setWorkspaceUri(uri: string | undefined): void {
    this.workspaceUri = uri;
  }
}
