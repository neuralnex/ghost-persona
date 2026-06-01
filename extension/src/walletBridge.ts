import * as vscode from 'vscode';
import * as crypto from 'crypto';

type PendingTransaction = {
  resolve: (txHash: `0x${string}`) => void;
  reject: (error: Error) => void;
};

const storyAeneid = {
  id: 1315,
  name: 'Story Aeneid Testnet',
  nativeCurrency: {
    name: 'IP',
    symbol: 'IP',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['https://aeneid.storyrpc.io']
    }
  }
};

export class StoryWalletBridge {
  private pendingTransactions = new Map<string, PendingTransaction>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string,
    private readonly getCompanionUrl: () => string | undefined
  ) {}

  public createWalletClient(walletAddress: `0x${string}`) {
    return {
      account: walletAddress,
      chain: storyAeneid,
      writeContract: async (request: any): Promise<`0x${string}`> => {
        return this.requestWalletTransaction(walletAddress, request);
      }
    };
  }

  public async requestWalletTransaction(walletAddress: `0x${string}`, request: any): Promise<`0x${string}`> {
    const companionUrl = this.getCompanionUrl();
    if (!companionUrl) {
      throw new Error('Configure ghostPersona.globalWalletUrl before starting wallet-paid CDR transactions.');
    }

    const txId = crypto.randomUUID();
    const callbackUri = await vscode.env.asExternalUri(
      vscode.Uri.parse(`${vscode.env.uriScheme}://${this.context.extension.id}/story-global-wallet`)
    );

    const functionAbi = Array.isArray(request.abi)
      ? request.abi.filter((entry: any) => entry?.type === 'function' && entry?.name === request.functionName)
      : request.abi;

    const txPayload = Buffer.from(JSON.stringify({
      address: request.address,
      abi: functionAbi,
      functionName: request.functionName,
      args: request.args ?? [],
      value: request.value?.toString(),
      from: walletAddress
    })).toString('base64url');

    const transactionUrl = vscode.Uri.parse(companionUrl).with({
      query: new URLSearchParams({
        mode: 'transaction',
        txId,
        walletAddress,
        callbackUri: callbackUri.toString(),
        workspace: this.workspaceRoot,
        tx: txPayload
      }).toString()
    });

    const result = new Promise<`0x${string}`>((resolve, reject) => {
      this.pendingTransactions.set(txId, { resolve, reject });
      setTimeout(() => {
        if (!this.pendingTransactions.has(txId)) return;
        this.pendingTransactions.delete(txId);
        reject(new Error('Wallet transaction timed out before a signed transaction hash was returned.'));
      }, 180_000);
    });

    await vscode.env.openExternal(transactionUrl);
    return result;
  }

  public resolveTransactionCallback(uri: vscode.Uri): boolean {
    const params = new URLSearchParams(uri.query);
    const txId = params.get('txId');
    if (!txId || !this.pendingTransactions.has(txId)) return false;

    const pending = this.pendingTransactions.get(txId)!;
    this.pendingTransactions.delete(txId);

    const error = params.get('error');
    if (error) {
      pending.reject(new Error(error));
      return true;
    }

    const txHash = params.get('txHash');
    if (!txHash || !txHash.startsWith('0x')) {
      pending.reject(new Error('Wallet callback did not include a transaction hash.'));
      return true;
    }

    pending.resolve(txHash as `0x${string}`);
    return true;
  }
}
