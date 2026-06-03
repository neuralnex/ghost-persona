import * as vscode from 'vscode';

export class GhostSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ghostContextView';
  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'connectWallet':
          await vscode.commands.executeCommand('ghostPersona.connectStoryGlobalWallet');
          break;
        case 'lockVault':
          await vscode.commands.executeCommand('ghostPersona.lockVault');
          break;
        case 'unlockVault':
          await vscode.commands.executeCommand('ghostPersona.unlockVault');
          break;
        case 'copyContext': {
          const markdown = await vscode.commands.executeCommand<string>('ghostPersona.getContextMarkdown');
          if (markdown) {
            await vscode.env.clipboard.writeText(markdown);
            vscode.window.showInformationMessage('Ghost Persona context copied to clipboard.');
          }
          break;
        }
        case 'appendPrompt':
          await vscode.commands.executeCommand('ghostPersona.appendDynamicPrompt');
          break;
        case 'clearLogs':
          await vscode.commands.executeCommand('ghostPersona.clearSessionLogs');
          break;
        case 'openGuide':
          await vscode.commands.executeCommand('ghostPersona.openGuide');
          break;
      }
    });
  }

  public notifyIdentityLocked(): void {
    this.broadcastUpdate();
  }

  public broadcastUpdate(): void {
    this.view?.webview.postMessage({ command: 'refresh' });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <title>Ghost Persona</title>
        <style>
          :root {
            color-scheme: light dark;
          }

          body {
            margin: 0;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
          }

          main {
            padding: 14px;
            display: grid;
            gap: 14px;
          }

          h1 {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
          }

          h2 {
            margin: 0 0 8px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            letter-spacing: 0;
          }

          p {
            margin: 0;
            line-height: 1.45;
            color: var(--vscode-descriptionForeground);
          }

          code {
            color: var(--vscode-textPreformat-foreground);
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            padding: 1px 4px;
            font-family: var(--vscode-editor-font-family);
          }

          section {
            display: grid;
            gap: 8px;
          }

          button {
            width: 100%;
            min-height: 30px;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            font: inherit;
            cursor: pointer;
          }

          button:hover {
            background: var(--vscode-button-hoverBackground);
          }

          button.secondary {
            color: var(--vscode-button-secondaryForeground);
            background: var(--vscode-button-secondaryBackground);
          }

          button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }

          .actions,
          .vault-actions {
            display: grid;
            gap: 6px;
          }

          .hint {
            font-size: 12px;
          }

          .status {
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background: var(--vscode-editor-background);
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <h1>Ghost Persona</h1>
          </header>

          <section class="status">
            <h2>Vault Flow</h2>
            <p>Lock is for first-time setup. Unlock is for returning to a workspace that already has a saved CDR vault.</p>
          </section>

          <section>
            <h2>Wallet</h2>
            <button id="connectWalletButton" type="button">Connect Story Global Wallet</button>
          </section>

          <section>
            <h2>CDR Vault</h2>
            <div class="vault-actions">
              <button id="lockVaultButton" type="button">Lock CDR Vault</button>
              <button id="unlockVaultButton" class="secondary" type="button">Unlock CDR Vault</button>
            </div>
            <p class="hint">Use Lock once for a new workspace. Use Unlock when <code>.ghost/config.json</code> already exists and you need to recover the key.</p>
          </section>

          <section>
            <h2>Context</h2>
            <div class="actions">
              <button id="copyContextButton" class="secondary" type="button">Copy JSON Context Prompt</button>
              <button id="appendPromptButton" class="secondary" type="button">Append Dynamic Prompt</button>
              <button id="clearLogsButton" class="secondary" type="button">Clear Session Logs</button>
            </div>
          </section>

          <section>
            <button id="openGuideButton" class="secondary" type="button">Open Guide</button>
          </section>
        </main>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const post = (command) => vscode.postMessage({ command });

          document.getElementById('connectWalletButton')?.addEventListener('click', () => post('connectWallet'));
          document.getElementById('lockVaultButton')?.addEventListener('click', () => post('lockVault'));
          document.getElementById('unlockVaultButton')?.addEventListener('click', () => post('unlockVault'));
          document.getElementById('copyContextButton')?.addEventListener('click', () => post('copyContext'));
          document.getElementById('appendPromptButton')?.addEventListener('click', () => post('appendPrompt'));
          document.getElementById('clearLogsButton')?.addEventListener('click', () => post('clearLogs'));
          document.getElementById('openGuideButton')?.addEventListener('click', () => post('openGuide'));
        </script>
      </body>
      </html>`;
  }
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
