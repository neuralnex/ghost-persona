# Ghost Persona: Hosting & Production Roadmap Guide

This guide details how to bundle, package, and host the **Ghost Persona** VS Code extension so developers can install and run it in their IDEs. It also outlines the critical structural features remaining now that the Story Global Wallet companion app has been designed.

---

## 1. Hosting & Publishing Your VS Code Extension

VS Code extensions are packaged as self-contained `.vsix` bundles and can be shared either publicly through marketplaces or privately.

```mermaid
graph TD
    A[Codebase] -->|npx vsce package| B(Local VSIX Package)
    B -->|Direct Share| C[Private Installation]
    B -->|npx vsce publish| D[VS Code Marketplace]
    B -->|npx ovsx publish| E[Open VSX Registry]
```

### Option A: The Official Visual Studio Marketplace (Public)
To make your extension searchable directly inside the VS Code Extensions tab:

1. **Create an Azure DevOps Organization**:
   - Go to [Azure DevOps](https://dev.azure.com) and create a free account.
   - Generate a **Personal Access Token (PAT)**:
     - Select **All accessible organizations** under Organization.
     - Set the scope to **Marketplace > Publish** (Read & Write permissions).
     - Copy the PAT safely.

2. **Set Up a Publisher Profile**:
   - Go to the [VS Code Marketplace Publisher Console](https://marketplace.visualstudio.com/manage).
   - Create a publisher account using a unique ID (e.g., `meru`). Make sure this matches the `"publisher": "meru"` field in your [package.json](file:///home/meru/remix-button/package.json#L9).

3. **Install VSCE Tooling**:
   Install the official Microsoft packaging tool:
   ```bash
   npm install -g @vscode/vsce
   ```

4. **Login and Package**:
   Inside the root of `/home/meru/remix-button`, authenticate and generate your bundle:
   ```bash
   vsce login <your-publisher-name>  # Paste your PAT when prompted
   vsce package
   ```
   This will generate a file named `ghost-persona-1.0.0.vsix` in your root folder.

5. **Publish to the Marketplace**:
   Publish it instantly to the web:
   ```bash
   vsce publish
   ```

---

### Option B: The Open VSX Registry (For VSCodium, Gitpod, Eclipse Theia)
To support developers using open-source variants of VS Code that do not access Microsoft’s proprietary marketplace:

1. Create an account at [open-vsx.org](https://open-vsx.org).
2. Obtain an access token.
3. Install the publisher CLI tool:
   ```bash
   npm install -g ovsx
   ```
4. Authenticate and publish your pre-built `.vsix` file:
   ```bash
   ovsx publish ghost-persona-1.0.0.vsix -t <your-token>
   ```

---

### Option C: Private Enterprise Distribution (Direct Sharing)
If you want to share the extension with a beta group or team without publishing it to the web:

1. Package the extension:
   ```bash
   vsce package
   ```
2. Distribute the `ghost-persona-1.0.0.vsix` file directly via email, Slack, or secure storage.
3. Instruct users to install it in their local VS Code by:
   - Clicking on the **Extensions icon (Ctrl+Shift+X)**.
   - Clicking the `...` menu in the top-right of the extensions panel.
   - Selecting **Install from VSIX...** and uploading your bundle.

---

## 2. Production Roadmap: Remaining Implementation Steps

Now that the companion app is built, you need to transition the extension architecture from a local-development structure to a production-ready model.

### 📋 The Technical Checklist

| Stage | Task | Priority | Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Configuration** | **Default Companion URL** | 🔴 High | `[ ]` | Hardcode your deployed production Vercel/Netlify URL into the configuration defaults of `package.json`. |
| **Security** | **Wallet-Paid Signing** | 🔴 High | `[x]` | Remove `GHOST_SOFTWARE_PRIVATE_KEY`; CDR transactions are reviewed, signed, and paid by the connected Story Global Wallet through the companion. |
| **Performance**| **Debounce & Cache Policies** | 🟡 Medium | `[ ]` | Prevent writing transaction fees to CDR on every single typing keystroke by optimizing the write intervals. |
| **UX & Branding**| **Webview Visual Polish** | 🟡 Medium | `[ ]` | Update the extension's activity bar sidebar with a premium dark-mode dashboard matching the companion's aesthetics. |
| **Clean Up** | **Packaging Ignore File** | 🟢 Low | `[ ]` | Ensure test scripts, local `.ghost` files, and raw `.env` configs are completely excluded from the package bundle. |

---

### 🔍 Next Steps Walkthrough

> [!IMPORTANT]
> **Production Wallet Signing**
> The extension no longer accepts a software private key. It builds the CDR contract request locally, opens the Story Global Wallet companion, and waits for the connected wallet to return the transaction hash. The user reviews, signs, and pays each CDR transaction directly.

> [!TIP]
> **Optimizing File Watcher Sync Frequency**
> The file watcher [watcher.ts](file:///home/meru/remix-button/extension/src/watcher.ts#L63-L75) currently flushes and syncs to disk exactly **3 seconds** after changes stabilize. 
> Local context updates are encrypted to disk. CDR writes are limited to vault/key lifecycle transactions instead of every single save.
> **How to fix this**:
> - Increase the flush debounce time to **5-10 minutes**, or only push updates when the user closes their window, commits code, or manually clicks a "Sync Secure State" button in the VS Code sidebar.

> [!WARNING]
> **VSCE Ignore Pattern**
> Ensure that your packaging manifest does not upload development secrets. Create a `.vscodeignore` file containing:
> ```text
> .env
> .ghost/**
> test-*.ts
> companion/**
> tsconfig.json
> node_modules/**
> ```
