# Confidential Data Rail Integration

Ghost Persona uses Story Protocol Confidential Data Rail (CDR) as the remote key-access layer for encrypted workspace memory.

## Local Encryption Boundary

Workspace context is encrypted locally before any network operation.

- The extension creates a 32-byte AES-256-GCM master key per workspace.
- The local encrypted payload is written to `.ghost/context.bin.enc`.
- Vault metadata is written to `.ghost/config.json`.
- Raw workspace memory is not sent to CDR.

The encrypted local payload contains:

- Recent workspace mutation logs.
- Dynamic prompt instructions.
- Context state used by IDE chat-router commands.

## CDR Vault Provisioning

When live mode is enabled, `PrivateWorkspaceManager.provisionWorkspaceVault()` allocates a CDR vault.

The vault is configured with:

- `writeConditionAddr`: signer wallet address.
- `readConditionAddr`: signer wallet address.
- `writeConditionData`: `0x`.
- `readConditionData`: `0x`.

The returned CDR `uuid` is stored in local metadata and used for later key synchronization and recovery.

## Master Key Synchronization

`PrivateWorkspaceManager.synchronizeMasterKey()` does not upload plaintext workspace data.

The flow is:

1. Fetch the CDR global public key.
2. Convert the vault UUID into a CDR label with `uuidToLabel`.
3. Encrypt the local AES master key with CDR threshold encryption.
4. Write the encrypted data-key package to the CDR vault.

Only the threshold-wrapped data key is committed to CDR.

## Workspace Recovery

On restart, `WorkspaceRecoveryManager.recoverMasterKey()` calls `consumer.accessCDR()`.

If access conditions are satisfied, CDR reconstructs the data key and returns the AES master key to the local runtime. The extension then decrypts `.ghost/context.bin.enc` locally.

## Identity Model

User identity is Story Global Wallet first.

The VS Code extension opens a configured companion wallet app with:

- `nonce`
- `callbackUri`
- `workspace`

The companion app signs a message containing the nonce and redirects back with:

- `address`
- `message`
- `signature`

The extension verifies the signature with `viem.verifyMessage` and stores only the public wallet address in `.ghost/identity.json`.

Private keys are not stored by Ghost Persona.

## Development Signer

Live CDR writes and reads still need a transaction signer in the current CLI and extension backend path.

For testnet development, provide:

```sh
GHOST_SOFTWARE_PRIVATE_KEY=0x...
STORY_CDR_API_URL=https://<cdr-api>
```

This path is for development and controlled testnet operations. Production user onboarding should rely on the Story Global Wallet companion flow.

## Relevant Files

- `sdk/src/client.ts`: initializes CDR SDK clients.
- `sdk/src/vault.ts`: allocates vaults and synchronizes encrypted data keys.
- `sdk/src/recovery.ts`: recovers threshold-wrapped keys.
- `extension/src/orchestrator.ts`: manages local encryption, checkout, and recovery lifecycle.
- `extension/src/extension.ts`: exposes wallet identity and chat-router commands.
