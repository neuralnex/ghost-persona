#!/usr/bin/env node
import { Command } from 'commander';
import { GhostCDRClient } from '../sdk/src/client.js';
import { WorkspaceOrchestrator } from '../extension/src/orchestrator.js';
import { GhostWorkspaceWatcher } from '../extension/src/watcher.js';
import { CommercialPersonaMarketplace } from '../sdk/src/marketplace.js';
import { GhostIdentityStore } from '../sdk/src/identity.js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

interface WatchOptions {
  mock: boolean;
}

const program = new Command();
program
  .name('ghost')
  .description('Ghost Persona: Sovereign Workspace Identity & Context IP Rails')
  .version('1.0.0');

async function getClientContext() {
  const privateKey = process.env.GHOST_SOFTWARE_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    throw new Error('GHOST_SOFTWARE_PRIVATE_KEY is required for live CDR transactions.');
  }

  const client = new GhostCDRClient({
    privateKey,
    rpcUrl: process.env.STORY_RPC_URL,
    apiUrl: process.env.STORY_CDR_API_URL
  });
  await client.init();
  return client;
}

program
  .command('watch')
  .description('Boot the secure workspace environment and attach the filesystem sync auto-watcher')
  .option('-m, --mock', 'Run the process using mock environment parameters offline', true)
  .action(async (options: WatchOptions) => {
    const workspaceRoot = path.resolve('./');
    const client = options.mock ? null : await getClientContext();
    const orchestrator = new WorkspaceOrchestrator(workspaceRoot, client, options.mock);
    
    const contextMemory = await orchestrator.checkIn();
    
    const watcher = new GhostWorkspaceWatcher(workspaceRoot, orchestrator);
    await watcher.start(contextMemory);

    process.on('SIGINT', () => {
      watcher.stop();
      console.log('\nGhost monitoring suspended safely.');
      process.exit(0);
    });
  });

program
  .command('identity')
  .description('Manage local wallet identity locks')
  .command('lock')
  .description('Lock this workspace to a public EVM wallet address')
  .argument('<walletAddress>', 'Public EVM wallet address')
  .action((walletAddress: string) => {
    const workspaceRoot = path.resolve('./');
    const identity = new GhostIdentityStore(workspaceRoot).lockWalletAddress(walletAddress, 'manual-address');
    console.log(`Wallet identity locked for ${identity.walletAddress}.`);
    console.log('No private key was stored.');
  });

program
  .command('monetize')
  .description('Register the active environment context as an IP Asset on Story Protocol with marketplace licensing parameters')
  .argument('<metadataUri>', 'The IPFS URI mapping your agent persona structural definitions')
  .action(async (metadataUri: string) => {
    if (!process.env.GHOST_SOFTWARE_PRIVATE_KEY) {
      console.error("Valid signing configuration is required for live deployment operations.");
      process.exit(1);
    }
    
    const client = await getClientContext();
    const marketplace = new CommercialPersonaMarketplace(client);
    
    const mockTerms = {
      mintingFeeWei: 1000000000000000000n,
      currencyTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`
    };

    try {
      const results = await marketplace.listPersonaToMarketplace(metadataUri, mockTerms);
      console.log('\nDeployment successful:');
      console.log(results);
    } catch (e: any) {
      console.error('Network submission exception:', e.message || e);
    }
  });

program.parse(process.argv);
