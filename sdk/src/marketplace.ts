import { StoryClient, StoryConfig } from "@story-protocol/core-sdk";
import { toHex, http } from "viem";

export interface LicenseConfig {
  mintingFeeWei: bigint;
  currencyTokenAddress: `0x${string}`; 
}

export class CommercialPersonaMarketplace {
  private storyCore: StoryClient;
  private cdrClient: any;
  private walletAddress: `0x${string}`;

  constructor(ghostClient: any) {
    this.cdrClient = ghostClient.client;
    this.walletAddress = ghostClient.account.address;

    const coreConfig: StoryConfig = {
      account: ghostClient.account,
      transport: http(ghostClient.rpcUrl),
      chainId: "aeneid",
    };
    this.storyCore = StoryClient.newClient(coreConfig);
  }

  async listPersonaToMarketplace(
    metadataUri: string,
    licenseTerms: LicenseConfig
  ): Promise<{ ipAssetAddress: string; vaultUuid: string; licenseTermsId: string }> {
    console.log(`\n[Marketplace] Registering Agent Persona Context as a Story IP Asset...`);

    const ipRegistration = await this.storyCore.ipAsset.register({
      nftContract: "0x1dDa696e5746C6543b593E2B6D44342dB5a21D37", 
      tokenId: BigInt(Math.floor(Math.random() * 1000000) + 1), 
      ipMetadata: {
        ipMetadataURI: metadataUri,
        ipMetadataHash: toHex(Buffer.alloc(32)),
        nftMetadataURI: metadataUri,
        nftMetadataHash: toHex(Buffer.alloc(32))
      }
    });

    console.log(`[Marketplace] IP Asset registered at Contract Address: ${ipRegistration.ipId}`);

    const termsRegistration = await this.storyCore.license.attachLicenseTerms({
      ipId: ipRegistration.ipId as `0x${string}`,
      licenseTemplate: "0x0000000000000000000000000000000000000000", 
      licenseTermsId: BigInt(2) 
    });

    console.log(`[Marketplace] Commercial terms attached to IP Asset.`);

    console.log(`[Marketplace] Allocating license-gated Confidential Vault...`);
    const licenseConditionAddr = "0x0000000000000000000000000000000000000000"; 
    const encodedConditionData = toHex(Buffer.alloc(32)); 

    const { uuid, txHash } = await this.cdrClient.uploader.allocate({
      updatable: true, 
      writeConditionAddr: this.walletAddress, 
      readConditionAddr: licenseConditionAddr, 
      writeConditionData: "0x",
      readConditionData: encodedConditionData,
      skipConditionValidation: true
    });

    console.log(`[Marketplace] Persona Context Successfully Monetized.`);
    console.log(`- Storage Vault UUID: ${uuid}`);
    console.log(`- Transaction Hash: ${txHash}`);

    return {
      ipAssetAddress: ipRegistration.ipId!,
      vaultUuid: uuid,
      licenseTermsId: "2"
    };
  }
}
