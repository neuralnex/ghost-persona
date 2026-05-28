import { GhostCDRClient } from "./sdk/src/client.js";

const RECOVERY_TEST_KEY = process.env.GHOST_SOFTWARE_PRIVATE_KEY as `0x${string}` | undefined;

async function runVerification() {
  if (!RECOVERY_TEST_KEY) {
    throw new Error("GHOST_SOFTWARE_PRIVATE_KEY is required for network verification.");
  }

  const ghost = new GhostCDRClient({ privateKey: RECOVERY_TEST_KEY });
  
  await ghost.init();

  console.log(`Verifying connection for wallet: ${ghost.account.address}`);

  try {
    const threshold = await ghost.client.observer.getOperationalThreshold();
    const allocateFee = await ghost.client.observer.getAllocateFee();
    const writeFee = await ghost.client.observer.getWriteFee();
    const readFee = await ghost.client.observer.getReadFee();

    console.log("\nBase Environment & Dependency Layout Verified.");
    console.log(`- Network DKG Node Threshold: ${threshold}`);
    console.log(`- Current Allocation Gas Fee: ${allocateFee} wei`);
    console.log(`- Current State Write Gas Fee: ${writeFee} wei`);
    console.log(`- Current Threshold Read Gas Fee: ${readFee} wei\n`);
  } catch (error) {
    console.error("Network Query Failed. Verify that Aeneid endpoints are fully functional:", error);
  }
}

runVerification();
