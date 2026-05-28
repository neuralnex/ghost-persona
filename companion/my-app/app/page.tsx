'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createWalletClient, custom } from 'viem';
import { mainnet } from 'viem/chains';
// Automatic global wallet injection import from Story SDK
import "@story-protocol/global-wallet/story";

type AuthState = 'idle' | 'connecting' | 'connected' | 'signing' | 'redirecting' | 'error' | 'awaiting_handshake';

function StoryGlobalWalletBridgeContent() {
  const searchParams = useSearchParams();

  // Handshake parameters sent from VS Code Extension
  const nonce = searchParams.get('nonce');
  const callbackUri = searchParams.get('callbackUri');
  const workspace = searchParams.get('workspace') || 'Unknown Workspace';

  const [state, setState] = useState<AuthState>('idle');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Validate that the request originated with correct state
    if (!nonce || !callbackUri) {
      setState('awaiting_handshake');
    }
  }, [nonce, callbackUri]);

  // Standard web3 connection handling that binds automatically
  const handleConnectAndSign = async () => {
    if (!nonce || !callbackUri) return;

    setState('connecting');
    setErrorMessage('');

    try {
      // 1. Establish web3 provider context. Story Global Wallet injects an EIP-1193 provider window object
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error('No web3 provider detected. Make sure the Story Global Wallet agent is active.');
      }

      // 2. Request connection and query accounts
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts authorized. Wallet connection rejected.');
      }

      const activeAddress = accounts[0];
      setWalletAddress(activeAddress);
      setState('signing');

      // 3. Bind client using standard Viem wrappers
      const walletClient = createWalletClient({
        chain: mainnet,
        transport: custom(ethereum)
      });

      // 4. Request cryptographic sign of the extension nonce
      const signatureMessage = `Ghost Persona Security Authentication Nonce: ${nonce}`;
      const signature = await walletClient.signMessage({
        account: activeAddress,
        message: signatureMessage
      });

      setState('redirecting');

      // 5. Build dynamic callback parameters
      const responseParams = new URLSearchParams({
        address: activeAddress,
        message: signatureMessage,
        signature: signature
      });

      // 6. Direct browser window scheme back to VS Code Local Handler
      const finalRedirectUrl = `${callbackUri}?${responseParams.toString()}`;

      setTimeout(() => {
        window.location.href = finalRedirectUrl;
      }, 1200);

    } catch (error: any) {
      console.error('Handshake flow execution error:', error);
      setState('error');
      setErrorMessage(error.message || 'Signature request cancelled by the user.');
    }
  };

  return (
    <div className="container">
      <div className="glow-orb"></div>

      <div className="card">
        <div className="logo-container">
          <span className="logo-icon">🛡️</span>
        </div>

        <div className="badge">
          <span className={`badge-dot ${state === 'redirecting' ? 'active' : ''}`}></span>
          <span>Sovereign Identity Protection</span>
        </div>

        <h1>Connect Ghost Persona</h1>
        <p className="subtitle">
          {state === 'awaiting_handshake' 
            ? 'Awaiting cryptographic handshake parameters from your code editor.'
            : 'Securely verify your wallet address and authenticate your local coding workspace using Story Global Wallet.'}
        </p>

        {nonce && callbackUri && (
          <div className="params-box">
            <div className="param-row">
              <span className="param-label">Workspace Folder</span>
              <span className="param-value" title={workspace}>{workspace}</span>
            </div>
            <div className="param-row">
              <span className="param-label">Secure Nonce Token</span>
              <span className="param-value">{nonce.substring(0, 18)}...</span>
            </div>
            {walletAddress && (
              <div className="param-row">
                <span className="param-label">Verified Address</span>
                <span className="param-value">{walletAddress}</span>
              </div>
            )}
          </div>
        )}

        {state === 'awaiting_handshake' && (
          <div className="params-box" style={{ textAlign: 'center', lineHeight: '1.6', background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.15)' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              This gateway secures your local context using decentralization. To link your wallet, run the command inside VS Code:
            </p>
            <p style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--neon-magenta)', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px' }}>
              Ghost Persona: Connect Story Global Wallet
            </p>
          </div>
        )}

        {state === 'idle' && nonce && callbackUri && (
          <button className="btn btn-primary" onClick={handleConnectAndSign}>
            Connect & Authenticate Workspace
          </button>
        )}

        {(state === 'connecting' || state === 'signing') && (
          <button className="btn btn-disabled" disabled>
            <div className="spinner"></div>
            {state === 'connecting' ? 'Authorizing Story Wallet...' : 'Requesting Cryptographic Signature...'}
          </button>
        )}

        {state === 'redirecting' && (
          <button className="btn btn-disabled" disabled style={{ color: '#A7F3D0' }}>
            ✓ Verification Successful! Redirecting back to VS Code...
          </button>
        )}

        {state === 'error' && (
          <>
            <button className="btn btn-primary" onClick={handleConnectAndSign}>
              Retry Handshake Connection
            </button>
            <div className="status-msg error">
              <span>⚠️</span> {errorMessage}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="container">
        <div className="card">
          <div className="logo-container">
            <span className="logo-icon">🛡️</span>
          </div>
          <h1>Initializing Security Gateway...</h1>
          <div className="spinner" style={{ margin: '24px auto' }}></div>
        </div>
      </div>
    }>
      <StoryGlobalWalletBridgeContent />
    </Suspense>
  );
}

