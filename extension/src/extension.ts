import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { GhostCDRClient } from '../../sdk/src/client.js';
import { WorkspaceOrchestrator } from './orchestrator.js';
import { GhostWorkspaceWatcher } from './watcher.js';
import { GhostContextInjector } from './injector.js';
import { GhostSidebarProvider } from './sidebar.js';
import { GhostIdentityStore } from '../../sdk/src/identity.js';
import { isAddress, verifyMessage } from 'viem';

let watcherInstance: GhostWorkspaceWatcher | null = null;
let orchestratorInstance: WorkspaceOrchestrator | null = null;
export let activeContextMemory: any = null;
let pendingWalletNonce: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log('[Ghost Persona] Activating extension workspace attachment...');

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.log('[Ghost Persona] No active folder detected. Standing down.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration('ghostPersona');
  const isMockMode = config.get<boolean>('mockMode', true);
  const identityStore = new GhostIdentityStore(workspaceRoot);

  try {
    let ghostClient: GhostCDRClient | null = null;
    if (!isMockMode) {
      let privateKey = await context.secrets.get('GHOST_SOFTWARE_PRIVATE_KEY') as `0x${string}` | undefined;
      if (!privateKey) {
        privateKey = process.env.GHOST_SOFTWARE_PRIVATE_KEY as `0x${string}` | undefined;
      }
      const rpcUrl = config.get<string>('rpcUrl');
      const apiUrl = config.get<string>('cdrApiUrl') || process.env.STORY_CDR_API_URL;

      if (!privateKey) {
        throw new Error("Live CDR mode requires setting a transaction signing private key via command 'Ghost Persona: Set Transaction Signing Private Key' or setting GHOST_SOFTWARE_PRIVATE_KEY in your environment.");
      }

      ghostClient = new GhostCDRClient({ privateKey, rpcUrl, apiUrl });
      await ghostClient.init();
    }

    orchestratorInstance = new WorkspaceOrchestrator(workspaceRoot, ghostClient, isMockMode);
    console.log(`[Ghost Persona] Running check-in pass for: ${workspaceRoot}`);
    activeContextMemory = await orchestratorInstance.checkIn();

    const sidebarProvider = new GhostSidebarProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        GhostSidebarProvider.viewType,
        sidebarProvider
      )
    );

    const debounceMs = config.get<number>('watcherDebounce', 3000);
    watcherInstance = new GhostWorkspaceWatcher(workspaceRoot, orchestratorInstance, debounceMs);

    watcherInstance.onFlushSuccess = () => {
      sidebarProvider.broadcastUpdate();
    };

    await watcherInstance.start(activeContextMemory);

    const injectCommand = vscode.commands.registerCommand('ghostPersona.getInjectedChatPipeline', (incomingMessages: any[]) => {
      const injector = new GhostContextInjector();
      return injector.injectIntoPromptPipeline(incomingMessages, activeContextMemory);
    });

    const contextCommand = vscode.commands.registerCommand('ghostPersona.getContextMarkdown', () => {
      const injector = new GhostContextInjector();
      return injector.formatContextToMarkdown(activeContextMemory);
    });

    const appendPromptCommand = vscode.commands.registerCommand('ghostPersona.appendDynamicPrompt', async (prompt?: string) => {
      const nextPrompt = prompt ?? await vscode.window.showInputBox({
        title: 'Add Ghost Persona Prompt',
        prompt: 'Enter a persistent instruction to inject into IDE chat routes.',
        ignoreFocusOut: true
      });

      if (!nextPrompt) return;
      activeContextMemory.dynamicPrompts = activeContextMemory.dynamicPrompts ?? [];
      activeContextMemory.dynamicPrompts.push(nextPrompt);
      await orchestratorInstance?.checkOut(activeContextMemory);
      sidebarProvider.broadcastUpdate();
    });

    const clearLogsCommand = vscode.commands.registerCommand('ghostPersona.clearSessionLogs', async () => {
      if (!activeContextMemory) return;
      activeContextMemory.sessionLogs = [];
      await orchestratorInstance?.checkOut(activeContextMemory);
      sidebarProvider.broadcastUpdate();
    });

    const lockIdentityCommand = vscode.commands.registerCommand('ghostPersona.lockWalletAddress', async (walletAddress?: string) => {
      const address = walletAddress ?? await vscode.window.showInputBox({
        title: 'Lock Wallet Address',
        prompt: 'Enter the public EVM address to associate with this workspace.',
        ignoreFocusOut: true,
        validateInput: value => isAddress(value) ? undefined : 'Enter a valid EVM address.'
      });

      if (!address) return;
      const identity = identityStore.lockWalletAddress(address, 'manual-address');
      await vscode.workspace.getConfiguration('ghostPersona').update('walletAddress', identity.walletAddress, vscode.ConfigurationTarget.Workspace);
      sidebarProvider.notifyIdentityLocked();
      vscode.window.showInformationMessage(`Ghost Persona locked wallet identity ${identity.walletAddress}.`);
    });

    const connectStoryWalletCommand = vscode.commands.registerCommand('ghostPersona.connectStoryGlobalWallet', async () => {
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

        const params = new URLSearchParams(uri.query);
        const address = params.get('address');
        const signature = params.get('signature') as `0x${string}` | null;
        const message = params.get('message');

        if (!address || !signature || !message || !pendingWalletNonce || !message.includes(pendingWalletNonce)) {
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
        sidebarProvider.notifyIdentityLocked();
        vscode.window.showInformationMessage(`Ghost Persona connected Story Global Wallet identity ${identity.walletAddress}.`);
      }
    });

    const setPrivateKeyCommand = vscode.commands.registerCommand('ghostPersona.setPrivateKey', async () => {
      const privateKey = await vscode.window.showInputBox({
        title: 'Set Transaction Signing Private Key',
        prompt: 'Enter your Story Protocol testnet wallet private key (starts with 0x). Keys are stored securely in your OS keychain.',
        ignoreFocusOut: true,
        password: true,
        validateInput: value => {
          if (!value || !value.startsWith('0x') || value.length !== 66) {
            return 'A valid 32-byte hexadecimal private key starting with 0x is required.';
          }
          return undefined;
        }
      });

      if (!privateKey) return;

      await context.secrets.store('GHOST_SOFTWARE_PRIVATE_KEY', privateKey);
      vscode.window.showInformationMessage('Story private key stored securely. Please reload VS Code to activate.');
    });

    context.subscriptions.push(
      injectCommand,
      contextCommand,
      appendPromptCommand,
      clearLogsCommand,
      lockIdentityCommand,
      connectStoryWalletCommand,
      setPrivateKeyCommand,
      uriHandler
    );
    vscode.window.showInformationMessage('Ghost Persona Sovereign Context Guard Active');

  } catch (error: any) {
    vscode.window.showErrorMessage(`Ghost Persona Boot Fault: ${error.message || error}`);
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
