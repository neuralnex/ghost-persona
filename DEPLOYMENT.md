# Deployment and End-to-End Testing

This guide covers local validation, Story Global Wallet setup, CDR testnet validation, and VS Code Marketplace packaging.

## 1. Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- VS Code 1.85 or newer.
- A funded Story Aeneid testnet signer for live CDR validation.
- A deployed Story Global Wallet companion app.

## 2. Configure Environment

Create a local `.env` file from the template:

```sh
cp .env.example .env
```

Set these values for live CDR testing:

```sh
STORY_RPC_URL=https://aeneid.storyrpc.io
STORY_CDR_API_URL=https://<cdr-api>
GHOST_SOFTWARE_PRIVATE_KEY=0x...
```

Do not commit `.env`.

## 3. Install and Build

```sh
npm install
npm run build
```

The compiled extension entry is:

```text
dist/extension/src/extension.js
```

The compiled CLI entry is:

```text
dist/bin/ghost.js
```

## 4. Story Global Wallet Companion App

Create or deploy a small client app that imports Story Global Wallet:

```tsx
import "@story-protocol/global-wallet/story";
```

The companion app must accept these query parameters:

- `nonce`
- `callbackUri`
- `workspace`

After the user connects with Story Global Wallet, ask the wallet to sign a message containing the nonce. Redirect back to the supplied `callbackUri` with:

- `address`
- `message`
- `signature`

Configure the extension setting:

```json
{
  "ghostPersona.globalWalletUrl": "https://<your-story-wallet-companion>/connect"
}
```

## 5. Local Extension Test

Build the extension:

```sh
npm run build
```

Open the repo in VS Code and run the launch config:

```text
Launch Extension
```

In the Extension Development Host:

1. Open the Ghost Persona Activity Bar view.
2. Click `Connect Story Global Wallet`.
3. Complete the companion app wallet flow.
4. Confirm `.ghost/identity.json` contains the verified wallet address.
5. Edit a source file.
6. Wait for the watcher debounce window.
7. Confirm the sidebar shows a new file mutation log.

## 6. Local Mock Watcher Test

Run:

```sh
npm run ghost -- watch --mock
```

Edit a file in the workspace and wait for the watcher flush. Confirm:

- `.ghost/config.json` exists.
- `.ghost/context.bin.enc` exists.
- No plaintext session state is written outside the runtime.

## 7. Live CDR Pipeline Test

Set the live environment:

```sh
STORY_RPC_URL=https://aeneid.storyrpc.io
STORY_CDR_API_URL=https://<cdr-api>
GHOST_SOFTWARE_PRIVATE_KEY=0x...
```

Run:

```sh
npx tsx test-pipeline.ts
```

Expected result:

- WASM primitives initialize.
- A CDR vault is allocated.
- The AES master key is threshold-wrapped and written.
- The key is recovered through CDR.
- The local encrypted context decrypts successfully.

## 8. Chat Router E2E Test

Run:

```sh
npx tsx test-injection.ts
```

Expected result:

- A system message is produced or updated.
- Recent workspace logs are injected into the prompt context.
- Dynamic prompts are preserved.

IDE agents can call:

- `ghostPersona.getInjectedChatPipeline`
- `ghostPersona.getContextMarkdown`

## 9. Packaging for VS Code Marketplace

Install the VS Code packaging tool:

```sh
npm install --save-dev @vscode/vsce
```

Build and package:

```sh
npm run build
npx vsce package
```

Before publishing:

- Confirm `.env`, `.ghost`, `node_modules`, and `dist` are ignored or intentionally packaged.
- Confirm `README.md`, `CDR.md`, and `DEPLOYMENT.md` are current.
- Confirm no private keys, API secrets, or local vault files are committed.
- Confirm the Story Global Wallet companion app is deployed and reachable.

Publish after authenticating with the Marketplace publisher account:

```sh
npx vsce publish
```

## 10. Production Readiness Checklist

- Build passes with `npm run build`.
- Extension launches in Extension Development Host.
- Story Global Wallet callback verifies a signed nonce.
- `.ghost/identity.json` stores only the public wallet address.
- Local context remains encrypted in `.ghost/context.bin.enc`.
- Live CDR pipeline passes against the intended testnet.
- Chat-router commands return usable context.
- Marketplace package contains no secrets or local vault state.
