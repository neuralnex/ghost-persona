# Ghost Persona

Local-first workspace memory for IDE agents.

Ghost Persona records workspace mutations, stores the context in an AES-256-GCM encrypted `.ghost` vault, and exposes chat-router commands that IDE agents can call before sending messages to an LLM.

## Documentation

- [CDR.md](./CDR.md): how Ghost Persona uses Story Confidential Data Rail.
- [DEPLOYMENT.md](./DEPLOYMENT.md): deployment and end-to-end testing guide.
- [.env.example](./.env.example): local environment template.

## Wallet Identity

Ghost Persona uses Story Global Wallet for user identity. Users authenticate through a companion web app, sign a nonce, and return the verified wallet address to the VS Code extension. Ghost Persona stores only the public address and signature-verified session metadata; it does not store wallet private keys.

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

When the sidebar opens the companion app, it sends `nonce`, `callbackUri`, and `workspace` query parameters. The companion app should ask the connected wallet to sign a message containing the nonce, then redirect to `callbackUri` with `address`, `message`, and `signature` query parameters.

## Commands

Connect a Story Global Wallet from the VS Code command palette:

```text
Ghost Persona: Connect Story Global Wallet
```

Run the local watcher in mock mode:

```sh
npm run ghost -- watch --mock
```

Run live CDR operations with an explicit software signer:

```sh
GHOST_SOFTWARE_PRIVATE_KEY=0x... STORY_CDR_API_URL=https://<cdr-api> npm run ghost -- watch --no-mock
```

The software signer path is for development and testnet operations only.

## IDE Router Surface

The VS Code extension contributes these commands:

- `ghostPersona.getInjectedChatPipeline`
- `ghostPersona.getContextMarkdown`
- `ghostPersona.appendDynamicPrompt`
- `ghostPersona.clearSessionLogs`
- `ghostPersona.connectStoryGlobalWallet`
