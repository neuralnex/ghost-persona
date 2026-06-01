# Ghost Persona

Local-first workspace memory for IDE agents.

Ghost Persona records workspace mutations, stores the context in an AES-256-GCM encrypted `.ghost` vault, and exposes chat-router commands that IDE agents can call before sending messages to an LLM.

## Documentation

- [Story Docs](https://docs.story.foundation/introduction): Story Network, wallet, and protocol background.
- [CDR.md](./CDR.md): how Ghost Persona uses Story Confidential Data Rail.
- [DEPLOYMENT.md](./DEPLOYMENT.md): deployment and end-to-end testing guide.
- [.env.example](./.env.example): local environment template.

## Wallet Identity

Ghost Persona uses Story Global Wallet for user identity and CDR transaction signing. Users authenticate through a companion web app, sign a nonce, and return the verified wallet address to the VS Code extension. When CDR needs an on-chain transaction, the extension opens the companion again so the connected wallet can review, sign, and pay directly. Ghost Persona stores only the public address and signature-verified session metadata; it never stores wallet private keys.

Configure the companion app URL in workspace settings:

```json
{
  "ghostPersona.globalWalletUrl": "https://<your-story-wallet-companion>/connect"
}
```

The companion app should import Story Global Wallet in its root client component:

```tsx
import "@story-protocol/global-wallet/story";
```

When the sidebar opens the companion app for authentication, it sends `nonce`, `callbackUri`, and `workspace` query parameters. The companion app asks the connected wallet to sign a message containing the nonce, then redirects to `callbackUri` with `address`, `message`, and `signature` query parameters.

When CDR needs a transaction, the extension opens the same companion with `mode=transaction`, `txId`, `walletAddress`, `callbackUri`, and an encoded `tx` payload. The companion submits the contract write through Story Global Wallet and redirects back with `txId` and `txHash`.

## Charging Model

Ghost Persona does not charge on every file change. File watcher updates are encrypted and written locally to `.ghost/context.bin.enc`.

The connected wallet is only asked to sign fee-bearing Story CDR transactions when the user explicitly locks or unlocks the workspace vault:

- First lock: allocates the CDR vault and writes the threshold-encrypted AES workspace key.
- Later unlock/recovery: reads the CDR vault so the AES workspace key can be reconstructed.
- Normal edits, prompt changes, context reads, and session-log clears: no CDR transaction; local encrypted write only.

## Commands

Run these from the VS Code command palette or the Ghost Persona sidebar.

### `Ghost Persona: Connect Story Global Wallet`

Verifies wallet identity by opening the companion app and asking the wallet to sign a nonce. This stores only the public wallet address in `.ghost/identity.json`.

This command does not create a CDR vault and does not submit a fee-bearing CDR transaction.

```text
Ghost Persona: Connect Story Global Wallet
```

### `Ghost Persona: Lock / Unlock CDR Vault`

Starts the production CDR lifecycle for the workspace. On a new workspace, it creates a local AES key, asks the connected wallet to allocate a CDR vault, and asks the wallet to write the threshold-encrypted AES key to that vault. On an existing workspace, it asks the wallet to perform CDR recovery so the local encrypted context can be decrypted.

```text
Ghost Persona: Lock / Unlock CDR Vault
```

### `Ghost Persona: Get Context Markdown`

Returns the current Ghost Persona context as markdown for IDE agents or manual copying. This is a local read.

### `Ghost Persona: Get Injected Chat Pipeline`

Accepts an existing chat-message array and injects Ghost Persona context into the system prompt. This is the command an IDE chat router should call before sending messages to an LLM.

### `Ghost Persona: Append Dynamic Prompt`

Adds a persistent local instruction to the encrypted workspace context. This updates the local encrypted vault file only.

### `Ghost Persona: Clear Session Logs`

Clears recorded file mutation logs from the encrypted local context. This updates the local encrypted vault file only.

## Sidebar Buttons

The Ghost Persona Activity Bar view exposes the main workflow:

- `Connect Story Global Wallet`: authenticate wallet identity.
- `Lock / Unlock CDR Vault`: trigger the wallet-paid CDR vault lifecycle.
- `Copy Context Markdown`: copy current context to clipboard.
- `Append Dynamic Prompt`: add a persistent prompt instruction.
- `Clear Session Logs`: remove local mutation logs from the encrypted context.

The vault button is disabled until the wallet is connected. Context, prompt, and log buttons are disabled until the vault is unlocked.

## CLI

The CLI is now informational only for production builds:

```sh
npm run ghost -- identity
```

It prints the current workspace wallet identity if one is locked. CDR signing runs through the VS Code extension and Story Global Wallet companion.

## IDE Router Surface

The VS Code extension contributes these commands:

- `ghostPersona.getInjectedChatPipeline`
- `ghostPersona.getContextMarkdown`
- `ghostPersona.appendDynamicPrompt`
- `ghostPersona.clearSessionLogs`
- `ghostPersona.connectStoryGlobalWallet`
- `ghostPersona.lockIntoVault`
