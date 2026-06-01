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
        case 'triggerVaultLock': {
          vscode.commands.executeCommand('ghostPersona.lockIntoVault');
          break;
        }
        case 'triggerGuide': {
          vscode.commands.executeCommand('ghostPersona.openGuide');
          break;
        }
        case 'triggerAppendPrompt': {
          vscode.commands.executeCommand('ghostPersona.appendDynamicPrompt');
          break;
        }
        case 'triggerClearLogs': {
          vscode.commands.executeCommand('ghostPersona.clearSessionLogs');
          break;
        }
        case 'triggerCopyContext': {
          const contextMarkdown = await vscode.commands.executeCommand<string>('ghostPersona.getContextMarkdown');
          await vscode.env.clipboard.writeText(contextMarkdown || '');
          vscode.window.showInformationMessage('Ghost Persona context copied to clipboard.');
          break;
        }
      }
    });
  }

  public broadcastUpdate() {
    if (this._view) {
      const config = vscode.workspace.getConfiguration('ghostPersona');
      const savedWallet = config.get<string>('walletAddress', '');
      this._view.webview.postMessage({
        type: 'updateState',
        payload: {
          vaultUuid: activeContextMemory?.vaultUuid || 'Wallet connection required',
          logs: activeContextMemory?.sessionLogs || [],
          prompts: activeContextMemory?.dynamicPrompts || [],
          isWalletConnected: savedWallet.length > 0,
          isVaultActive: Boolean(activeContextMemory?.vaultUuid)
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
          .actions {
            display: grid;
            gap: 8px;
          }
          button.secondary {
            color: var(--vscode-button-secondaryForeground);
            background: var(--vscode-button-secondaryBackground);
          }
          button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          button:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }
          button:disabled:hover {
            background: var(--vscode-button-background);
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
          <section class="panel">
            <p class="label">Workspace Vault Controls</p>
            <div class="actions">
              <button id="vaultButton" type="button">Lock / Unlock CDR Vault</button>
              <button id="guideButton" class="secondary" type="button">Open Guide</button>
              <button id="copyContextButton" class="secondary" type="button">Copy Context Markdown</button>
              <button id="appendPromptButton" class="secondary" type="button">Append Dynamic Prompt</button>
              <button id="clearLogsButton" class="secondary" type="button">Clear Session Logs</button>
            </div>
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
          const vaultButton = document.getElementById('vaultButton');
          const guideButton = document.getElementById('guideButton');
          const copyContextButton = document.getElementById('copyContextButton');
          const appendPromptButton = document.getElementById('appendPromptButton');
          const clearLogsButton = document.getElementById('clearLogsButton');

          authButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'triggerAuth' });
          });
          vaultButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'triggerVaultLock' });
          });
          guideButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'triggerGuide' });
          });
          copyContextButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'triggerCopyContext' });
          });
          appendPromptButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'triggerAppendPrompt' });
          });
          clearLogsButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'triggerClearLogs' });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type !== 'updateState') return;

            vault.textContent = message.payload.vaultUuid || 'Locked';
            logs.replaceChildren();

            if (message.payload.isWalletConnected) {
              authButton.hidden = true;
              authStatus.hidden = false;
              vaultButton.disabled = false;
            } else {
              authButton.hidden = false;
              authStatus.hidden = true;
              vaultButton.disabled = true;
            }

            copyContextButton.disabled = !message.payload.isVaultActive;
            appendPromptButton.disabled = !message.payload.isVaultActive;
            clearLogsButton.disabled = !message.payload.isVaultActive;

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
