import { GhostStorageManager } from '../../sdk/src/storage.js';
import { GhostCryptoEngine } from '../../sdk/src/crypto.js';
import { PrivateWorkspaceManager } from '../../sdk/src/vault.js';
import { WorkspaceRecoveryManager } from '../../sdk/src/recovery.js';
import * as crypto from 'crypto';

export class WorkspaceOrchestrator {
  private storage: GhostStorageManager;
  private activeMasterKey: Uint8Array | null = null;
  private activeDecryptedContext: string = '';

  constructor(
    private workspaceRoot: string,
    private ghostClient: any,
    private mockMode: boolean = false
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

      let uuid = `LOCAL-${crypto.randomUUID()}`;
      
      if (!this.mockMode) {
        const vaultManager = new PrivateWorkspaceManager(this.ghostClient);
        uuid = await vaultManager.provisionWorkspaceVault();
        await vaultManager.synchronizeMasterKey(uuid, this.activeMasterKey);
      } else {
        console.log(`[Mock Mode] Bypassing on-chain deployment. Assigned Virtual UUID: ${uuid}`);
      }

      const pack = GhostCryptoEngine.encryptContext(this.activeDecryptedContext, this.activeMasterKey);
      this.storage.saveEncryptedContainer(pack.ciphertext);
      this.storage.saveMetadata({
        vaultUuid: uuid,
        iv: pack.iv,
        tag: pack.tag,
        mockMasterKey: this.mockMode ? Buffer.from(this.activeMasterKey).toString('hex') : undefined
      });
      
      return JSON.parse(this.activeDecryptedContext);
    }

    console.log(`[Orchestrator] Mapped existing Vault Connection: ${meta.vaultUuid}`);
    
    if (this.mockMode) {
      console.log(`[Mock Mode] Simulating decentralized threshold key recovery...`);
      if (!meta.mockMasterKey) {
        throw new Error("Mock workspace metadata is missing its local recovery key. Remove .ghost to create a fresh mock vault, or run with live CDR recovery enabled.");
      }
      this.activeMasterKey = Buffer.from(meta.mockMasterKey, 'hex');
      if (this.activeMasterKey.byteLength !== 32) {
        throw new Error("Mock workspace metadata contains an invalid AES-256 recovery key.");
      }
    } else {
      const recoveryManager = new WorkspaceRecoveryManager(this.ghostClient);
      this.activeMasterKey = await recoveryManager.recoverMasterKey(meta.vaultUuid);
    }

    const ciphertext = this.storage.readEncryptedContainer();
    this.activeDecryptedContext = GhostCryptoEngine.decryptContext(ciphertext, meta.iv, meta.tag, this.activeMasterKey);
    
    console.log(`[Orchestrator] Workspace Context successfully populated into volatile system variables.`);
    return JSON.parse(this.activeDecryptedContext);
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
      tag: pack.tag,
      mockMasterKey: this.mockMode ? meta.mockMasterKey ?? Buffer.from(this.activeMasterKey).toString('hex') : undefined
    });

    if (!this.mockMode) {
      const vaultManager = new PrivateWorkspaceManager(this.ghostClient);
      await vaultManager.synchronizeMasterKey(meta.vaultUuid, this.activeMasterKey);
    }

    console.log(`[Orchestrator] Session files securely stored on disk.`);
  }
}
