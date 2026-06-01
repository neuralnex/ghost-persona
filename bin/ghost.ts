#!/usr/bin/env node
import { Command } from 'commander';
import { GhostIdentityStore } from '../sdk/src/identity.js';
import * as path from 'path';

const program = new Command();
program
  .name('ghost')
  .description('Ghost Persona production utilities')
  .version('1.0.0');

program
  .command('identity')
  .description('Read the local Story Global Wallet identity lock')
  .action(() => {
    const workspaceRoot = path.resolve('./');
    const identity = new GhostIdentityStore(workspaceRoot).readLockedIdentity();

    if (!identity) {
      console.log('No Story Global Wallet identity is locked for this workspace yet.');
      return;
    }

    console.log(`Wallet identity: ${identity.walletAddress}`);
    console.log(`Signer type: ${identity.signerType}`);
    console.log(`Locked at: ${identity.lockedAt}`);
  });

program
  .command('watch')
  .description('Start the production watcher from the VS Code extension, where Story Global Wallet can sign CDR transactions.')
  .action(() => {
    console.error('The production CDR watcher now runs from the VS Code extension after Story Global Wallet connection.');
    console.error('No software private key or mock signer is supported in the CLI.');
    process.exit(1);
  });

program
  .command('monetize')
  .description('Marketplace publishing requires a wallet-signed production flow and is not available from the local CLI.')
  .action(() => {
    console.error('Marketplace transactions must be signed by the connected wallet in the production companion flow.');
    process.exit(1);
  });

program.parse(process.argv);
