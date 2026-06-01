import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { GhostCDRClient } from '../../sdk/src/client.js';
import { WorkspaceOrchestrator } from './orchestrator.js';
import { GhostWorkspaceWatcher } from './watcher.js';
import { GhostContextInjector } from './injector.js';
import { GhostSidebarProvider } from './sidebar.js';
import { GhostIdentityStore } from '../../sdk/src/identity.js';
import { StoryWalletBridge } from './walletBridge.js';
import { isAddress, verifyMessage } from 'viem';

let watcherInstance: GhostWorkspaceWatcher | null = null;
let orchestratorInstance: WorkspaceOrchestrator | null = null;
let sidebarProvider: GhostSidebarProvider | null = null;
let walletBridge: StoryWalletBridge | null = null;
export let activeContextMemory: any = null;
let pendingWalletNonce: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log('[Ghost Persona] Activating production wallet-gated workspace attachment...');

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.log('[Ghost Persona] No active folder detected. Standing down.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const identityStore = new GhostIdentityStore(workspaceRoot);

  sidebarProvider = new GhostSidebarProvider(context.extensionUri);
  walletBridge = new StoryWalletBridge(
    context,
    workspaceRoot,
    () => vscode.workspace.getConfiguration('ghostPersona').get<string>('globalWalletUrl')
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GhostSidebarProvider.viewType,
      sidebarProvider
    )
  );

  const injectCommand = vscode.commands.registerCommand('ghostPersona.getInjectedChatPipeline', (incomingMessages: any[]) => {
    const injector = new GhostContextInjector();
    return injector.injectIntoPromptPipeline(incomingMessages, activeContextMemory);
  });

  const contextCommand = vscode.commands.registerCommand('ghostPersona.getContextMarkdown', () => {
    const injector = new GhostContextInjector();
    return injector.formatContextToMarkdown(activeContextMemory);
  });

  const appendPromptCommand = vscode.commands.registerCommand('ghostPersona.appendDynamicPrompt', async (prompt?: string) => {
    if (!activeContextMemory || !orchestratorInstance) {
      vscode.window.showWarningMessage('Connect Story Global Wallet before adding Ghost Persona prompts.');
      return;
    }

    const nextPrompt = prompt ?? await vscode.window.showInputBox({
      title: 'Add Ghost Persona Prompt',
      prompt: 'Enter a persistent instruction to inject into IDE chat routes.',
      ignoreFocusOut: true
    });

    if (!nextPrompt) return;
    activeContextMemory.dynamicPrompts = activeContextMemory.dynamicPrompts ?? [];
    activeContextMemory.dynamicPrompts.push(nextPrompt);
    await orchestratorInstance.checkOut(activeContextMemory);
    sidebarProvider?.broadcastUpdate();
  });

  const clearLogsCommand = vscode.commands.registerCommand('ghostPersona.clearSessionLogs', async () => {
    if (!activeContextMemory || !orchestratorInstance) return;
    activeContextMemory.sessionLogs = [];
    await orchestratorInstance.checkOut(activeContextMemory);
    sidebarProvider?.broadcastUpdate();
  });

  const openGuideCommand = vscode.commands.registerCommand('ghostPersona.openGuide', () => {
    showGhostPersonaGuide(context);
  });

  const connectStoryWalletCommand = vscode.commands.registerCommand('ghostPersona.connectStoryGlobalWallet', async () => {
    const config = vscode.workspace.getConfiguration('ghostPersona');
    const globalWalletUrl = config.get<string>('globalWalletUrl');

    if (!globalWalletUrl) {
      vscode.window.showWarningMessage('Configure ghostPersona.globalWalletUrl to connect through a Story Global Wallet companion app.');
      return;
    }

    pendingWalletNonce = crypto.randomUUID();
    const callbackUri = await vscode.env.asExternalUri(
      vscode.Uri.parse(`${vscode.env.uriScheme}://${context.extension.id}/story-global-wallet`)
    );
    const loginUrl = vscode.Uri.parse(globalWalletUrl).with({
      query: new URLSearchParams({
        mode: 'auth',
        nonce: pendingWalletNonce,
        callbackUri: callbackUri.toString(),
        workspace: workspaceRoot
      }).toString()
    });

    await vscode.env.openExternal(loginUrl);
  });

  const uriHandler = vscode.window.registerUriHandler({
    async handleUri(uri: vscode.Uri) {
      if (uri.path !== '/story-global-wallet') return;

      if (walletBridge?.resolveTransactionCallback(uri)) {
        return;
      }

      const params = new URLSearchParams(uri.query);
      const address = params.get('address');
      const signature = params.get('signature') as `0x${string}` | null;
      const message = params.get('message');

      if (!address || !isAddress(address) || !signature || !message || !pendingWalletNonce || !message.includes(pendingWalletNonce)) {
        vscode.window.showErrorMessage('Story Global Wallet authentication response was incomplete.');
        return;
      }

      const verified = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature
      });

      if (!verified) {
        vscode.window.showErrorMessage('Story Global Wallet signature verification failed.');
        return;
      }

      const identity = identityStore.lockWalletAddress(address, 'story-global-wallet');
      pendingWalletNonce = null;
      await vscode.workspace.getConfiguration('ghostPersona').update('walletAddress', identity.walletAddress, vscode.ConfigurationTarget.Workspace);
      sidebarProvider?.notifyIdentityLocked();
      vscode.window.showInformationMessage(`Ghost Persona connected Story Global Wallet identity ${identity.walletAddress}.`);
      sidebarProvider?.broadcastUpdate();
    }
  });

  const lockIntoVaultCommand = vscode.commands.registerCommand('ghostPersona.lockIntoVault', async () => {
    await initializeProductionRuntime(workspaceRoot, identityStore);
  });

  context.subscriptions.push(
    injectCommand,
    contextCommand,
    appendPromptCommand,
    clearLogsCommand,
    openGuideCommand,
    connectStoryWalletCommand,
    lockIntoVaultCommand,
    uriHandler
  );

  sidebarProvider.broadcastUpdate();
}

function showGhostPersonaGuide(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'ghostPersonaGuide',
    'Ghost Persona Guide',
    vscode.ViewColumn.One,
    {
      enableScripts: false,
      localResourceRoots: [context.extensionUri]
    }
  );

  panel.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
      <title>Ghost Persona Guide</title>
      <style>
        body {
          margin: 0;
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
          font-family: var(--vscode-font-family);
          line-height: 1.5;
        }
        main {
          max-width: 820px;
          padding: 28px;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 700;
        }
        h2 {
          margin: 28px 0 10px;
          font-size: 16px;
          font-weight: 700;
        }
        p, li {
          color: var(--vscode-descriptionForeground);
          font-size: 13px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
          margin-top: 14px;
        }
        .card {
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 12px;
          background: var(--vscode-sideBar-background);
        }
        .card strong {
          display: block;
          margin-bottom: 6px;
          color: var(--vscode-foreground);
        }
        code {
          color: var(--vscode-textPreformat-foreground);
          background: var(--vscode-textCodeBlock-background);
          border-radius: 4px;
          padding: 1px 4px;
          font-family: var(--vscode-editor-font-family);
        }
      </style>
    </head>
    <body>
      <main>
        <h1>Ghost Persona</h1>
        <p>Encrypted workspace memory for IDE agents, backed by Story Global Wallet identity and CDR key recovery.</p>

        <h2>First Run</h2>
        <div class="grid">
          <div class="card">
            <strong>1. Connect Wallet</strong>
            <p>Run <code>Ghost Persona: Connect Story Global Wallet</code>. This verifies your public wallet address with a nonce signature. No CDR gas fee is charged here.</p>
          </div>
          <div class="card">
            <strong>2. Lock Vault</strong>
            <p>Run <code>Ghost Persona: Lock / Unlock CDR Vault</code>. On a new workspace, this asks your wallet to pay required Story/CDR network fees to allocate the vault and write the encrypted workspace key.</p>
          </div>
          <div class="card">
            <strong>3. Work Normally</strong>
            <p>File changes, prompts, logs, and context updates are encrypted locally in <code>.ghost/context.bin.enc</code>. They do not trigger wallet charges.</p>
          </div>
        </div>

        <h2>Unlocking</h2>
        <p>If a workspace already has a vault UUID in <code>.ghost/config.json</code>, <code>Lock / Unlock CDR Vault</code> recovers the AES workspace key through CDR so the local encrypted context can be decrypted.</p>

        <h2>Commands</h2>
        <ul>
          <li><code>Connect Story Global Wallet</code>: verify wallet identity only.</li>
          <li><code>Lock / Unlock CDR Vault</code>: create or recover the CDR-protected workspace key.</li>
          <li><code>Copy Context Markdown</code>: copy current context for agents or debugging.</li>
          <li><code>Append Dynamic Prompt</code>: add a persistent encrypted local instruction.</li>
          <li><code>Clear Session Logs</code>: clear encrypted local file mutation history.</li>
        </ul>

        <h2>Billing</h2>
        <p>The wallet pays only required Story/CDR network fees for vault lifecycle transactions. Ghost Persona does not charge on every edit.</p>
      </main>
    </body>
    </html>`;
}

async function initializeProductionRuntime(workspaceRoot: string, identityStore: GhostIdentityStore): Promise<void> {
  if (orchestratorInstance || watcherInstance) {
    sidebarProvider?.broadcastUpdate();
    return;
  }

  const identity = identityStore.readLockedIdentity();
  if (!identity) {
    sidebarProvider?.broadcastUpdate();
    vscode.window.showInformationMessage('Connect Story Global Wallet before locking into a production CDR vault.');
    return;
  }

  if (!walletBridge) {
    throw new Error('Story wallet bridge was not initialized.');
  }

  try {
    const config = vscode.workspace.getConfiguration('ghostPersona');
    const walletClient = walletBridge.createWalletClient(identity.walletAddress);
    const ghostClient = new GhostCDRClient({
      walletAddress: identity.walletAddress,
      walletClient,
      rpcUrl: config.get<string>('rpcUrl'),
      apiUrl: config.get<string>('cdrApiUrl')
    });

    await ghostClient.init();

    orchestratorInstance = new WorkspaceOrchestrator(workspaceRoot, ghostClient);
    console.log(`[Ghost Persona] Running production CDR check-in pass for: ${workspaceRoot}`);
    activeContextMemory = await orchestratorInstance.checkIn();

    const debounceMs = config.get<number>('watcherDebounce', 300_000);
    watcherInstance = new GhostWorkspaceWatcher(workspaceRoot, orchestratorInstance, debounceMs);
    watcherInstance.onFlushSuccess = () => {
      sidebarProvider?.broadcastUpdate();
    };

    await watcherInstance.start(activeContextMemory);
    sidebarProvider?.broadcastUpdate();
    vscode.window.showInformationMessage('Ghost Persona Sovereign Context Guard Active');
  } catch (error: any) {
    orchestratorInstance = null;
    watcherInstance?.stop();
    watcherInstance = null;
    vscode.window.showErrorMessage(`Ghost Persona Production Boot Fault: ${error.message || error}`);
  }
}

export async function deactivate() {
  console.log('[Ghost Persona] Deactivating workspace window. Running flush...');
  
  if (watcherInstance) {
    watcherInstance.stop();
  }

  if (orchestratorInstance && activeContextMemory) {
    try {
      await orchestratorInstance.checkOut(activeContextMemory);
      console.log('[Ghost Persona] Session wrapped and securely saved to disk.');
    } catch (e) {
      console.error('Ghost Persona checkout failure:', e);
    }
  }
}
