'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createWalletClient, custom } from 'viem';
import { mainnet } from 'viem/chains';
import "@story-protocol/global-wallet/story";

type AuthState = 'idle' | 'connecting' | 'connected' | 'signing' | 'redirecting' | 'error';

function StoryGlobalWalletBridgeContent() {
    const searchParams = useSearchParams();

    const nonce = searchParams.get('nonce');
    const callbackUri = searchParams.get('callbackUri');
    const workspace = searchParams.get('workspace') || 'Unknown Workspace';

    const [state, setState] = useState<AuthState>('idle');
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (!nonce || !callbackUri) {
            setState('error');
            setErrorMessage('Missing authentication parameters. Make sure to open this page directly from your VS Code editor.');
        }
    }, [nonce, callbackUri]);

    const handleConnectAndSign = async () => {
        if (!nonce || !callbackUri) return;

        setState('connecting');
        setErrorMessage('');

        try {
            const ethereum = (window as any).ethereum;
            if (!ethereum) {
                throw new Error('No web3 provider detected. Make sure the Story Global Wallet agent is active.');
            }

            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts authorized. Wallet connection rejected.');
            }

            const activeAddress = accounts[0];
            setWalletAddress(activeAddress);
            setState('signing');

            const walletClient = createWalletClient({
                chain: mainnet,
                transport: custom(ethereum)
            });

            const signatureMessage = `Ghost Persona Security Authentication Nonce: ${nonce}`;
            const signature = await walletClient.signMessage({
                account: activeAddress,
                message: signatureMessage
            });

            setState('redirecting');

            const responseParams = new URLSearchParams({
                address: activeAddress,
                message: signatureMessage,
                signature: signature
            });

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
                    Securely verify your wallet address and authenticate your local coding workspace workspace using Story Global Wallet.
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

                {state === 'idle' && (
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

export default function StoryGlobalWalletBridge() {
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