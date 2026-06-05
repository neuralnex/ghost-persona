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
            color-scheme: dark;
            --ghost-bg: #050806;
            --ghost-panel: rgba(8, 18, 12, 0.86);
            --ghost-panel-strong: rgba(10, 28, 17, 0.94);
            --ghost-line: rgba(76, 255, 155, 0.22);
            --ghost-line-strong: rgba(92, 255, 168, 0.45);
            --ghost-green: #4cff9b;
            --ghost-text: #e7fff1;
            --ghost-muted: rgba(207, 255, 224, 0.68);
            --ghost-shadow: 0 0 24px rgba(54, 255, 137, 0.18);
          }

          body {
            margin: 0;
            min-width: 0;
            color: var(--ghost-text);
            background:
              radial-gradient(circle at 14% 0%, rgba(76, 255, 155, 0.18), transparent 34%),
              linear-gradient(160deg, #07110a 0%, var(--ghost-bg) 46%, #020302 100%);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
          }

          body::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background-image:
              linear-gradient(rgba(76, 255, 155, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(76, 255, 155, 0.035) 1px, transparent 1px);
            background-size: 18px 18px;
            mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.78), transparent 82%);
          }

          main {
            position: relative;
            box-sizing: border-box;
            width: 100%;
            min-width: 0;
            padding: 14px;
            display: grid;
            gap: 14px;
          }

          header {
            padding: 14px;
            border: 1px solid var(--ghost-line);
            border-radius: 8px;
            background:
              linear-gradient(135deg, rgba(76, 255, 155, 0.14), rgba(76, 255, 155, 0.03)),
              var(--ghost-panel);
            box-shadow: var(--ghost-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.05);
            overflow: hidden;
          }

          h1 {
            margin: 0;
            font-size: clamp(18px, 7vw, 25px);
            line-height: 1;
            font-weight: 800;
            letter-spacing: 0;
            color: var(--ghost-text);
            text-shadow: 0 0 18px rgba(76, 255, 155, 0.44);
          }

          h2 {
            margin: 0 0 8px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--ghost-green);
            letter-spacing: 0;
          }

          p {
            margin: 0;
            line-height: 1.45;
            color: var(--ghost-muted);
          }

          code {
            color: var(--ghost-green);
            background: rgba(76, 255, 155, 0.1);
            border-radius: 4px;
            padding: 1px 4px;
            font-family: var(--vscode-editor-font-family);
            word-break: break-word;
          }

          section {
            display: grid;
            gap: 8px;
            min-width: 0;
          }

          button {
            position: relative;
            width: 100%;
            min-width: 0;
            min-height: 38px;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 8px;
            padding: 9px 11px;
            border: 1px solid var(--ghost-line-strong);
            border-radius: 8px;
            color: #061007;
            background:
              linear-gradient(135deg, var(--ghost-green), #b6ffd2 52%, #2df083);
            box-shadow:
              0 0 18px rgba(76, 255, 155, 0.24),
              inset 0 1px 0 rgba(255, 255, 255, 0.4);
            font: inherit;
            font-weight: 750;
            letter-spacing: 0;
            cursor: pointer;
            overflow: hidden;
            transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, background 120ms ease;
          }

          button:hover {
            border-color: rgba(206, 255, 224, 0.72);
            box-shadow:
              0 0 28px rgba(76, 255, 155, 0.42),
              inset 0 1px 0 rgba(255, 255, 255, 0.46);
            transform: translateY(-1px);
          }

          button:focus-visible {
            outline: 2px solid rgba(225, 255, 235, 0.9);
            outline-offset: 2px;
          }

          button:active {
            transform: translateY(0);
          }

          button::after {
            content: ">";
            min-width: 1ch;
            color: rgba(5, 18, 8, 0.72);
            font-weight: 900;
          }

          button.secondary {
            color: var(--ghost-text);
            background:
              linear-gradient(135deg, rgba(76, 255, 155, 0.16), rgba(76, 255, 155, 0.04)),
              rgba(4, 10, 6, 0.84);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          }

          button.secondary:hover {
            background:
              linear-gradient(135deg, rgba(76, 255, 155, 0.23), rgba(76, 255, 155, 0.08)),
              rgba(5, 14, 8, 0.95);
          }

          button.secondary::after {
            color: var(--ghost-green);
          }

          .brand-kicker {
            margin-top: 8px;
            color: var(--ghost-muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0;
          }

          .wallet-panel {
            padding: 10px;
            border: 1px solid var(--ghost-line);
            border-radius: 8px;
            background:
              linear-gradient(180deg, rgba(76, 255, 155, 0.09), rgba(76, 255, 155, 0.02)),
              var(--ghost-panel-strong);
            box-shadow: var(--ghost-shadow);
          }

          .connect-button {
            min-height: 48px;
            padding: 11px 12px;
            font-size: 13px;
          }

          .button-text {
            min-width: 0;
            overflow-wrap: anywhere;
            text-align: left;
            line-height: 1.2;
          }

          .actions,
          .vault-actions {
            display: grid;
            gap: 6px;
            min-width: 0;
          }

          .hint {
            font-size: 12px;
          }

          .status {
            padding: 10px;
            border: 1px solid var(--ghost-line);
            border-radius: 8px;
            background: var(--ghost-panel);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          }

          @media (max-width: 190px) {
            main {
              padding: 10px;
              gap: 10px;
            }

            header,
            .status,
            .wallet-panel {
              padding: 9px;
            }

            button {
              grid-template-columns: minmax(0, 1fr);
              min-height: 42px;
            }

            button::after {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <h1>Ghost Persona</h1>
            <p class="brand-kicker">Encrypted wallet context</p>
          </header>

          <section class="status">
            <h2>Vault Flow</h2>
            <p>Lock is for first-time setup. Unlock is for returning to a workspace that already has a saved CDR vault.</p>
          </section>

          <section class="wallet-panel">
            <h2>Wallet</h2>
            <button id="connectWalletButton" class="connect-button" type="button"><span class="button-text">Connect Story Global Wallet</span></button>
          </section>

          <section>
            <h2>CDR Vault</h2>
            <div class="vault-actions">
              <button id="lockVaultButton" type="button"><span class="button-text">Lock CDR Vault</span></button>
              <button id="unlockVaultButton" class="secondary" type="button"><span class="button-text">Unlock CDR Vault</span></button>
            </div>
            <p class="hint">Use Lock once for a new workspace. Use Unlock when <code>.ghost/config.json</code> already exists and you need to recover the key.</p>
          </section>

          <section>
            <h2>Context</h2>
            <div class="actions">
              <button id="copyContextButton" class="secondary" type="button"><span class="button-text">Copy JSON Context Prompt</span></button>
              <button id="appendPromptButton" class="secondary" type="button"><span class="button-text">Append Dynamic Prompt</span></button>
              <button id="clearLogsButton" class="secondary" type="button"><span class="button-text">Clear Session Logs</span></button>
            </div>
          </section>

          <section>
            <button id="openGuideButton" class="secondary" type="button"><span class="button-text">Open Guide</span></button>
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
