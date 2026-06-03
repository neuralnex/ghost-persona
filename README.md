# Ghost Persona

Local-first workspace memory for IDE agents (Open Source).

Ghost Persona records workspace mutations, stores the context in an AES-256-GCM encrypted `.ghost` vault, and exposes chat-router commands that IDE agents can call before sending messages to an LLM.

## Documentation

- [Story Docs](https://docs.story.foundation/introduction): Story Network, wallet, and protocol background.
- [CDR.md](./CDR.md): how Ghost Persona uses Story Confidential Data Rail.
- [.env.example](./.env.example): local environment template.

## Install From GitHub Release

Ghost Persona can be installed from the release `.vsix` file without publishing to a marketplace.

1. Download [Ghost Persona](https://github.com/neuralnex/ghost-persona/releases/download/v1.0.3/ghost-persona-1.0.3.vsix).
3. Install it in your editor using one of the methods below.

### VS Code

From the UI:

1. Open Extensions.
2. Select the `...` menu.
3. Choose `Install from VSIX...`.
4. Pick the downloaded `ghost-persona-<version>.vsix` file.

From the terminal:

```sh
code --install-extension ghost-persona-1.0.3.vsix --force
```

### Cursor

From the UI:

1. Open Extensions.
2. Select the `...` menu.
3. Choose `Install from VSIX...`.
4. Pick the downloaded `ghost-persona-<version>.vsix` file.

From the terminal:

```sh
cursor --install-extension ghost-persona-1.0.3.vsix --force
```

### Other VS Code-Compatible IDEs

Most VS Code-compatible editors support VSIX installation from the Extensions view. If the editor exposes a CLI compatible with VS Code, use:

```sh
<editor-command> --install-extension ghost-persona-1.0.3.vsix --force
```

After installation, reload the editor and open the Ghost Persona Activity Bar view.

## Wallet Identity

Ghost Persona uses Story Global Wallet for user identity and CDR transaction signing. Users authenticate through a companion web app, sign a nonce, and return the verified wallet address to the VS Code extension. When CDR needs an on-chain transaction, the extension opens the companion again so the connected wallet can review, sign, and pay directly. Ghost Persona stores only the public address and signature-verified session metadata; it never stores wallet private keys.

Configure the companion app URL in workspace settings:

```json
{
  "ghostPersona.globalWalletUrl": "https://<your-story-wallet-companion>/connect"
}
```

Configure CDR separately from the EVM RPC endpoint. On Aeneid testnet, `ghostPersona.rpcUrl` is used for on-chain reads and writes, while `ghostPersona.cdrApiUrl` is the Story-API REST endpoint used for DKG state such as the global public key:

```json
{
  "ghostPersona.rpcUrl": "https://aeneid.storyrpc.io",
  "ghostPersona.cdrApiUrl": "http://172.192.41.96:1317"
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

### `Ghost Persona: Lock CDR Vault`

Use this once for a new workspace. It creates a local AES key, asks the connected wallet to allocate a CDR vault, and asks the wallet to write the threshold-encrypted AES key to that vault.

```text
Ghost Persona: Lock CDR Vault
```

### `Ghost Persona: Unlock CDR Vault`

Use this when returning to a workspace that already has `.ghost/config.json` with a vault UUID. It asks the wallet to perform CDR recovery so the local encrypted context can be decrypted.

```text
Ghost Persona: Unlock CDR Vault
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
- `Lock CDR Vault`: create a new CDR vault for this workspace.
- `Unlock CDR Vault`: recover an existing CDR vault for this workspace.
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
- `ghostPersona.lockVault`
- `ghostPersona.unlockVault`
