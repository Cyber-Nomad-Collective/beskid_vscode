import * as vscode from "vscode";
import { WEBVIEW_CSP_META } from "./webviewHtml.js";

/** Shared CSP and script wiring for WebviewPanel instances. */
export abstract class WebviewPanelHost {
  protected panel: vscode.WebviewPanel | undefined;

  protected bindPanel(
    panel: vscode.WebviewPanel,
    localRoots: vscode.Uri[] = [],
  ): void {
    this.panel = panel;
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: localRoots,
    };
    panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  protected bindCommandMessages(): void {
    this.panel?.webview.onDidReceiveMessage((message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        (message as { type?: string }).type === "command" &&
        "command" in message &&
        typeof (message as { command?: string }).command === "string"
      ) {
        void vscode.commands.executeCommand((message as { command: string }).command);
      }
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        (message as { type?: string }).type === "close"
      ) {
        this.panel?.dispose();
      }
    });
  }

  protected postHtml(html: string): void {
    if (this.panel) {
      this.panel.webview.html = html;
    }
  }

  protected onMessage(handler: (message: unknown) => void): vscode.Disposable | undefined {
    return this.panel?.webview.onDidReceiveMessage(handler);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  reveal(): void {
    this.panel?.reveal(vscode.ViewColumn.Active, false);
  }
}

export function modalShellStyles(): string {
  return `
    html, body {
      height: 100%;
      margin: 0;
      overflow: hidden;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .scrim {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .dialog {
      width: min(480px, 100%);
      max-height: min(85vh, 640px);
      overflow: auto;
      border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-radius: 8px;
      background: var(--vscode-editor-background);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
      padding: 0;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    }
    .dialog-header strong { font-size: 13px; }
    .dialog-body { padding: 12px; }
    button.close {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 2px 6px;
    }
  `;
}

export function modalDocumentOpen(bodyInnerHtml: string, title = "Beskid"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${WEBVIEW_CSP_META}
  <style>${modalShellStyles()}</style>
</head>
<body>
  <div class="scrim" id="scrim">
    <div class="dialog" role="dialog" aria-label="${title}">
      <div class="dialog-header">
        <strong>${title}</strong>
        <button class="close" id="close" title="Close">✕</button>
      </div>
      <div class="dialog-body">${bodyInnerHtml}</div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('close')?.addEventListener('click', () => vscode.postMessage({ type: 'close' }));
    document.getElementById('scrim')?.addEventListener('click', (e) => {
      if (e.target.id === 'scrim') vscode.postMessage({ type: 'close' });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
    });
    document.querySelectorAll('button[data-command]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'command', command: btn.getAttribute('data-command') });
      });
    });
  </script>
</body>
</html>`;
}
