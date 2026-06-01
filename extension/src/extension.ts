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
    connectStoryWalletCommand,
    lockIntoVaultCommand,
    uriHandler
  );

  sidebarProvider.broadcastUpdate();
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
