import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { createPublicClient, http, type WalletClient } from "viem";

export interface GhostClientConfig {
  walletAddress: `0x${string}`;
  walletClient: WalletClient | any;
  rpcUrl?: string;
  apiUrl?: string;
}

export class GhostCDRClient {
  public client!: CDRClient;
  public account: { address: `0x${string}` };
  public rpcUrl: string;
  public apiUrl: string;
  private isInitialized = false;

  constructor(config: GhostClientConfig) {
    this.rpcUrl = config.rpcUrl ?? process.env.STORY_RPC_URL ?? "https://aeneid.storyrpc.io";
    this.apiUrl = config.apiUrl ?? process.env.STORY_CDR_API_URL ?? "";

    if (!this.apiUrl) {
      throw new Error("STORY_CDR_API_URL or GhostClientConfig.apiUrl is required.");
    }

    this.account = { address: config.walletAddress };

    const publicClient = createPublicClient({
      transport: http(this.rpcUrl),
    });

    this.client = new CDRClient({
      network: "testnet",
      publicClient,
      walletClient: config.walletClient,
      apiUrl: this.apiUrl,
    });
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log("Ghost Persona: Initializing WASM Primitives...");
    await initWasm();
    this.isInitialized = true;
    console.log("Ghost Persona: WASM Initialization Complete.");
  }
}
