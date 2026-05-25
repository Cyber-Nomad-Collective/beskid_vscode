import * as vscode from "vscode";

/**
 * Shared helpers for Beskid custom webviews (dashboard, future templates panel, etc.).
 * Keeps CSP, disposal, and refresh wiring consistent across providers.
 */
export abstract class WebviewHost {
  protected view: vscode.WebviewView | undefined;

  protected bindWebview(webviewView: vscode.WebviewView, localRoots: vscode.Uri[] = []): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: localRoots,
    };
  }

  /** Wire `{ type: 'command', command: string }` messages from inline webview scripts. */
  protected bindCommandMessages(): void {
    this.onMessage((message: unknown) => {
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
    });
  }

  protected postHtml(html: string): void {
    if (this.view) {
      this.view.webview.html = html;
    }
  }

  protected onMessage(handler: (message: unknown) => void): vscode.Disposable | undefined {
    return this.view?.webview.onDidReceiveMessage(handler);
  }
}
