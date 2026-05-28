import * as vscode from 'vscode';
import { activeContextMemory } from './extension.js';

export class GhostSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ghostContextView';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'requestInit': {
          this.broadcastUpdate();
          break;
        }
        case 'triggerAuth': {
          vscode.commands.executeCommand('ghostPersona.connectStoryGlobalWallet');
          break;
        }
      }
    });
  }

  public broadcastUpdate() {
    if (this._view && activeContextMemory) {
      this._view.webview.postMessage({
        type: 'updateState',
        payload: {
          vaultUuid: activeContextMemory.vaultUuid || 'Local vault pending',
          logs: activeContextMemory.sessionLogs || [],
          prompts: activeContextMemory.dynamicPrompts || []
        }
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <title>Ghost Persona UI</title>
        <style>
          :root {
            color-scheme: dark;
          }
          body {
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
            background: var(--vscode-sideBar-background);
            margin: 0;
          }
          .shell {
            display: grid;
            gap: 14px;
            padding: 14px;
            font-size: 12px;
          }
          .panel {
            border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
            border-radius: 6px;
            padding: 12px;
            background: var(--vscode-sideBarSectionHeader-background);
          }
          .label {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0;
            margin: 0 0 8px;
            text-transform: uppercase;
          }
          button {
            width: 100%;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            padding: 7px 9px;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            cursor: pointer;
            font: inherit;
            font-weight: 600;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .mono {
            font-family: var(--vscode-editor-font-family);
            overflow-wrap: anywhere;
          }
          .vault {
            border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
            border-radius: 4px;
            padding: 8px;
            background: var(--vscode-input-background);
            font-size: 10px;
          }
          .logs {
            display: grid;
            gap: 6px;
            max-height: 220px;
            overflow: auto;
            border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
            border-radius: 4px;
            padding: 8px;
            background: var(--vscode-editor-background);
            font-size: 10px;
          }
          .empty {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
          }
          .log {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
          }
          .status {
            color: var(--vscode-testing-iconPassed);
            font-family: var(--vscode-editor-font-family);
          }
        </style>
      </head>
      <body>
        <main class="shell">
          <section class="panel">
            <p class="label">Identity Security Status</p>
            <button id="authButton" type="button">Connect Story Global Wallet</button>
            <div id="authStatus" class="status" hidden>Story Global Wallet identity connected</div>
          </section>
          <section>
            <p class="label">Active Storage Vault Link</p>
            <div id="vault" class="vault mono">Locked</div>
          </section>
          <section>
            <p class="label">Live Flight Recorder Session Logs</p>
            <div id="logs" class="logs mono">
              <div class="empty">Awaiting directory file mutations...</div>
            </div>
          </section>
        </main>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const vault = document.getElementById('vault');
          const logs = document.getElementById('logs');
          const authButton = document.getElementById('authButton');
          const authStatus = document.getElementById('authStatus');

          authButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'triggerAuth' });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type !== 'updateState') return;

            vault.textContent = message.payload.vaultUuid || 'Locked';
            logs.replaceChildren();

            if (!message.payload.logs || message.payload.logs.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'empty';
              empty.textContent = 'Awaiting directory file mutations...';
              logs.appendChild(empty);
              return;
            }

            for (const item of message.payload.logs) {
              const row = document.createElement('div');
              row.className = 'log';
              row.textContent = item;
              logs.appendChild(row);
            }
          });

          window.addEventListener('message', event => {
            if (event.data.type !== 'identityLocked') return;
            authButton.hidden = true;
            authStatus.hidden = false;
          });

          vscode.postMessage({ type: 'requestInit' });
        </script>
      </body>
      </html>`;
  }

  public notifyIdentityLocked() {
    this._view?.webview.postMessage({ type: 'identityLocked' });
  }

  private _getNonce() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
      text += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return text;
  }
}
