import { uuidToLabel } from "@piplabs/cdr-sdk";
import { toHex } from "viem";

export class PrivateWorkspaceManager {
  private client: any;
  private walletAddress: `0x${string}`;

  constructor(ghostClient: any) {
    this.client = ghostClient.client;
    this.walletAddress = ghostClient.account.address;
  }

  async provisionWorkspaceVault(): Promise<string> {
    const { uploader } = this.client;

    console.log(`[Story CDR] Allocating new vault mapped to owner: ${this.walletAddress}...`);
    
    const { uuid, txHash } = await uploader.allocate({
      updatable: false,
      writeConditionAddr: this.walletAddress,
      readConditionAddr: this.walletAddress,
      writeConditionData: "0x",
      readConditionData: "0x",
      skipConditionValidation: true
    });

    console.log(`[Story CDR] Vault provisioned. UUID: ${uuid} | Tx: ${txHash}`);
    return uuid;
  }

  async synchronizeMasterKey(uuid: string, localMasterKey: Uint8Array): Promise<string> {
    const { uploader, observer } = this.client;

    console.log(`[Story CDR] Generating TDH2 threshold wrapper parameters...`);

    const globalPubKey = await observer.getGlobalPubKey();
    const label = uuidToLabel(Number(uuid));

    const ciphertext = await uploader.encryptDataKey({
      dataKey: localMasterKey,
      globalPubKey,
      label
    });

    const writeFee = await observer.getWriteFee();
    console.log(`[Story CDR] Committing threshold package to vault (Paying fee: ${writeFee} wei)...`);

    const { txHash } = await uploader.write({
      uuid,
      accessAuxData: "0x",
      encryptedData: toHex(ciphertext.raw),
      value: writeFee
    });

    console.log(`[Story CDR] Key Sync Complete. Tx: ${txHash}`);
    return txHash;
  }
}
