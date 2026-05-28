import fsExtra from 'fs-extra';
import * as path from 'path';
import { isAddress } from 'viem';

export interface LockedIdentity {
  walletAddress: `0x${string}`;
  signerType: 'story-global-wallet' | 'manual-address';
  lockedAt: string;
}

export class GhostIdentityStore {
  private ghostDir: string;
  private identityPath: string;

  constructor(workspaceRoot: string) {
    this.ghostDir = path.join(workspaceRoot, '.ghost');
    this.identityPath = path.join(this.ghostDir, 'identity.json');
  }

  public lockWalletAddress(
    walletAddress: string,
    signerType: LockedIdentity['signerType'] = 'story-global-wallet'
  ): LockedIdentity {
    if (!isAddress(walletAddress)) {
      throw new Error('A valid EVM wallet address is required.');
    }

    fsExtra.ensureDirSync(this.ghostDir);

    const identity: LockedIdentity = {
      walletAddress: walletAddress as `0x${string}`,
      signerType,
      lockedAt: new Date().toISOString()
    };

    fsExtra.writeJsonSync(this.identityPath, identity, { spaces: 2 });
    return identity;
  }

  public readLockedIdentity(): LockedIdentity | null {
    if (!fsExtra.existsSync(this.identityPath)) return null;
    return fsExtra.readJsonSync(this.identityPath) as LockedIdentity;
  }
}
