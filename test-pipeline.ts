import { GhostCDRClient } from "./sdk/src/client.js";
import { GhostCryptoEngine } from "./sdk/src/crypto.js";
import { PrivateWorkspaceManager } from "./sdk/src/vault.js";
import { WorkspaceRecoveryManager } from "./sdk/src/recovery.js";
import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

const PRIVATE_KEY = process.env.GHOST_SOFTWARE_PRIVATE_KEY as `0x${string}` | undefined;

async function runPipeline() {
  if (!PRIVATE_KEY) {
    throw new Error("GHOST_SOFTWARE_PRIVATE_KEY is required for the live pipeline test.");
  }

  const ghostClient = new GhostCDRClient({ privateKey: PRIVATE_KEY });
  await ghostClient.init();

  const workspaceManager = new PrivateWorkspaceManager(ghostClient);
  const recoveryManager = new WorkspaceRecoveryManager(ghostClient);

  console.log("\n--- RUNNING GHOST PERSONA BACKEND SYSTEM LIFECYCLE ---");

  const developerContextData = JSON.stringify({
    persona: "Security Auditor Agent",
    workspacePath: process.cwd(),
    activePrompts: ["Scan contract inputs for RANDAO generation faults", "Enforce local AES storage models"]
  });

  const localMasterKey = GhostCryptoEngine.generateMasterKey();
  const encryptedLocalBundle = GhostCryptoEngine.encryptContext(developerContextData, localMasterKey);
  
  console.log("[Local Edge] Codebase files wrapped inside AES-256-GCM container.");

  const vaultUuid = await workspaceManager.provisionWorkspaceVault();
  await workspaceManager.synchronizeMasterKey(vaultUuid, localMasterKey);

  console.log("\n--- RESTARTING SIMULATED AGENT ENVIRONMENT ---");

  const recoveredKey = await recoveryManager.recoverMasterKey(vaultUuid);

  const unpackedContext = GhostCryptoEngine.decryptContext(
    encryptedLocalBundle.ciphertext,
    encryptedLocalBundle.iv,
    encryptedLocalBundle.tag,
    recoveredKey
  );

  console.log("\n[Pipeline Success] Decoupled Threshold Loop Equilibrium Achieved.");
  console.log("Verified Re-assembled Memory File Target Output:");
  console.log(JSON.parse(unpackedContext));
}

runPipeline().catch(console.error);
