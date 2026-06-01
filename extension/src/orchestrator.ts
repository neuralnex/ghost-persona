import { GhostStorageManager } from '../../sdk/src/storage.js';
import { GhostCryptoEngine } from '../../sdk/src/crypto.js';
import { PrivateWorkspaceManager } from '../../sdk/src/vault.js';
import { WorkspaceRecoveryManager } from '../../sdk/src/recovery.js';

export class WorkspaceOrchestrator {
  private storage: GhostStorageManager;
  private activeMasterKey: Uint8Array | null = null;
  private activeDecryptedContext: string = '';

  constructor(
    private workspaceRoot: string,
    private ghostClient: any
  ) {
    this.storage = new GhostStorageManager(workspaceRoot);
    this.storage.ensureGhostStructure();
  }

  async checkIn(): Promise<any> {
    console.log(`[Orchestrator] Running Check-In for: ${this.workspaceRoot}`);
    const meta = this.storage.readMetadata();

    if (!meta) {
      console.log(`[Orchestrator] No existing profile detected. Creating brand-new Workspace Identity...`);
      
      this.activeMasterKey = GhostCryptoEngine.generateMasterKey();
      this.activeDecryptedContext = JSON.stringify({ sessionLogs: [], dynamicPrompts: [] });

      if (!this.ghostClient) {
        throw new Error('A verified Story Global Wallet is required before creating a production CDR vault.');
      }

      const vaultManager = new PrivateWorkspaceManager(this.ghostClient);
      const uuid = await vaultManager.provisionWorkspaceVault();
      await vaultManager.synchronizeMasterKey(uuid, this.activeMasterKey);

      const pack = GhostCryptoEngine.encryptContext(this.activeDecryptedContext, this.activeMasterKey);
      this.storage.saveEncryptedContainer(pack.ciphertext);
      this.storage.saveMetadata({
        vaultUuid: String(uuid),
        iv: pack.iv,
        tag: pack.tag
      });
      
      return { ...JSON.parse(this.activeDecryptedContext), vaultUuid: String(uuid) };
    }

    console.log(`[Orchestrator] Mapped existing Vault Connection: ${meta.vaultUuid}`);

    if (!this.ghostClient) {
      throw new Error('A verified Story Global Wallet is required before recovering this production CDR vault.');
    }

    const recoveryManager = new WorkspaceRecoveryManager(this.ghostClient);
    this.activeMasterKey = await recoveryManager.recoverMasterKey(meta.vaultUuid);

    const ciphertext = this.storage.readEncryptedContainer();
    this.activeDecryptedContext = GhostCryptoEngine.decryptContext(ciphertext, meta.iv, meta.tag, this.activeMasterKey);
    
    console.log(`[Orchestrator] Workspace Context successfully populated into volatile system variables.`);
    return { ...JSON.parse(this.activeDecryptedContext), vaultUuid: meta.vaultUuid };
  }

  async checkOut(updatedContextObj: any): Promise<void> {
    if (!this.activeMasterKey) throw new Error("Cryptographic state uninitialized. Call checkIn first.");

    console.log(`[Orchestrator] Packaging modified session memory parameters...`);
    const meta = this.storage.readMetadata();
    if (!meta) throw new Error("Metadata configurations missing.");

    this.activeDecryptedContext = JSON.stringify(updatedContextObj);
    const pack = GhostCryptoEngine.encryptContext(this.activeDecryptedContext, this.activeMasterKey);

    this.storage.saveEncryptedContainer(pack.ciphertext);
    this.storage.saveMetadata({
      vaultUuid: meta.vaultUuid,
      iv: pack.iv,
      tag: pack.tag
    });

    // The master key is synchronized to the on-chain vault once during initial checkIn.
    // Subsequent checkOut passes only update the local encrypted context payload on disk,
    // avoiding redundant blockchain writes and eliminating transaction latency/gas fees.

    console.log(`[Orchestrator] Session files securely stored on disk.`);
  }
}
