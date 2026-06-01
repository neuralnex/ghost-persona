'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createWalletClient, custom } from 'viem';
import '@story-protocol/global-wallet/story';

type FlowState = 'idle' | 'connecting' | 'signing' | 'transacting' | 'redirecting' | 'error';

const storyAeneid = {
    id: 1315,
    name: 'Story Aeneid Testnet',
    nativeCurrency: {
        name: 'IP',
        symbol: 'IP',
        decimals: 18
    },
    rpcUrls: {
        default: {
            http: ['https://aeneid.storyrpc.io']
        }
    }
} as const;

function StoryGlobalWalletBridgeContent() {
    const searchParams = useSearchParams();

    const mode = searchParams.get('mode') ?? 'auth';
    const rawNonce = searchParams.get('nonce');
    const rawCallbackUri = searchParams.get('callbackUri');
    const rawWorkspace = searchParams.get('workspace');
    const txId = searchParams.get('txId');
    const expectedWalletAddress = searchParams.get('walletAddress');
    const txPayload = searchParams.get('tx');

    const nonce = rawNonce ? decodeURIComponent(rawNonce) : null;
    const callbackUri = rawCallbackUri ? decodeURIComponent(rawCallbackUri) : null;
    const workspace = rawWorkspace ? decodeURIComponent(rawWorkspace) : 'Unknown Workspace';
    const isTransactionMode = mode === 'transaction';

    const [state, setState] = useState<FlowState>('idle');
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        const validAuth = !isTransactionMode && nonce && callbackUri;
        const validTransaction = isTransactionMode && callbackUri && txId && txPayload;

        if (!validAuth && !validTransaction) {
            setState('error');
            setErrorMessage('Missing wallet parameters. Make sure to open this page directly from your VS Code editor.');
        }
    }, [callbackUri, isTransactionMode, nonce, txId, txPayload]);

    const redirectWithParams = (params: URLSearchParams) => {
        if (!callbackUri) return;
        const cleanCallbackUri = decodeURIComponent(callbackUri);
        const separator = cleanCallbackUri.includes('?') ? '&' : '?';
        const finalRedirectUrl = `${cleanCallbackUri}${separator}${params.toString()}`;

        setTimeout(() => {
            window.location.href = finalRedirectUrl;
        }, 900);
    };

    const getEthereum = () => {
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
            throw new Error('No web3 provider detected. Make sure Story Global Wallet is active.');
        }
        return ethereum;
    };

    const requestActiveAccount = async () => {
        const ethereum = getEthereum();
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts authorized. Wallet connection rejected.');
        }
        const activeAddress = accounts[0] as string;
        setWalletAddress(activeAddress);
        return { ethereum, activeAddress };
    };

    const decodeTransactionPayload = () => {
        if (!txPayload) throw new Error('Missing transaction payload.');
        const normalized = txPayload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalized));
        return {
            ...decoded,
            value: decoded.value ? BigInt(decoded.value) : undefined
        };
    };

    const handleConnectAndSign = async () => {
        if (!nonce || !callbackUri) return;

        setState('connecting');
        setErrorMessage('');

        try {
            const { ethereum, activeAddress } = await requestActiveAccount();
            setState('signing');

            const walletClient = createWalletClient({
                chain: storyAeneid,
                transport: custom(ethereum)
            });

            const signatureMessage = `Ghost Persona Security Authentication Nonce: ${nonce}`;
            const signature = await walletClient.signMessage({
                account: activeAddress as `0x${string}`,
                message: signatureMessage
            });

            setState('redirecting');
            redirectWithParams(new URLSearchParams({
                address: activeAddress,
                message: signatureMessage,
                signature
            }));
        } catch (error: any) {
            console.error('Handshake flow execution error:', error);
            setState('error');
            setErrorMessage(error.message || 'Signature request cancelled by the user.');
        }
    };

    const handleSignTransaction = async () => {
        if (!callbackUri || !txId) return;

        setState('connecting');
        setErrorMessage('');

        try {
            const { ethereum, activeAddress } = await requestActiveAccount();
            if (expectedWalletAddress && activeAddress.toLowerCase() !== expectedWalletAddress.toLowerCase()) {
                throw new Error(`Switch Story Global Wallet to ${expectedWalletAddress} before signing this workspace transaction.`);
            }

            setState('transacting');
            const transaction = decodeTransactionPayload();
            const walletClient = createWalletClient({
                account: activeAddress as `0x${string}`,
                chain: storyAeneid,
                transport: custom(ethereum)
            });

            const txHash = await walletClient.writeContract({
                account: activeAddress as `0x${string}`,
                chain: storyAeneid,
                address: transaction.address,
                abi: transaction.abi,
                functionName: transaction.functionName,
                args: transaction.args ?? [],
                value: transaction.value
            });

            setState('redirecting');
            redirectWithParams(new URLSearchParams({
                txId,
                txHash
            }));
        } catch (error: any) {
            console.error('Transaction signing flow error:', error);
            const message = error.message || 'Transaction request cancelled by the user.';
            setState('error');
            setErrorMessage(message);
            redirectWithParams(new URLSearchParams({
                txId: txId ?? '',
                error: message
            }));
        }
    };

    const primaryAction = isTransactionMode ? handleSignTransaction : handleConnectAndSign;

    return (
        <div className="container">
            <div className="glow-orb"></div>

            <div className="card">
                <div className="logo-container">
                    <span className="logo-icon">GP</span>
                </div>

                <div className="badge">
                    <span className={`badge-dot ${state === 'redirecting' ? 'active' : ''}`}></span>
                    <span>Sovereign Identity Protection</span>
                </div>

                <h1>Connect Ghost Persona</h1>
                <p className="subtitle">
                    {isTransactionMode
                        ? 'Review and sign the Story CDR transaction requested by your local Ghost Persona workspace.'
                        : 'Securely verify your wallet address and authenticate your local coding workspace using Story Global Wallet.'}
                </p>

                {callbackUri && (
                    <div className="params-box">
                        <div className="param-row">
                            <span className="param-label">Workspace Folder</span>
                            <span className="param-value" title={workspace}>{workspace}</span>
                        </div>
                        {nonce && (
                            <div className="param-row">
                                <span className="param-label">Secure Nonce Token</span>
                                <span className="param-value">{nonce.substring(0, 18)}...</span>
                            </div>
                        )}
                        {txId && (
                            <div className="param-row">
                                <span className="param-label">Transaction Request</span>
                                <span className="param-value">{txId.substring(0, 18)}...</span>
                            </div>
                        )}
                        {walletAddress && (
                            <div className="param-row">
                                <span className="param-label">Verified Address</span>
                                <span className="param-value">{walletAddress}</span>
                            </div>
                        )}
                    </div>
                )}

                {state === 'idle' && (
                    <button className="btn btn-primary" onClick={primaryAction}>
                        {isTransactionMode ? 'Review & Sign CDR Transaction' : 'Connect & Authenticate Workspace'}
                    </button>
                )}

                {(state === 'connecting' || state === 'signing' || state === 'transacting') && (
                    <button className="btn btn-disabled" disabled>
                        <div className="spinner"></div>
                        {state === 'connecting'
                            ? 'Authorizing Story Wallet...'
                            : state === 'transacting'
                                ? 'Waiting for Wallet Transaction Signature...'
                                : 'Requesting Cryptographic Signature...'}
                    </button>
                )}

                {state === 'redirecting' && (
                    <button className="btn btn-disabled" disabled style={{ color: '#A7F3D0' }}>
                        Verification successful. Returning to VS Code...
                    </button>
                )}

                {state === 'error' && (
                    <>
                        <button className="btn btn-primary" onClick={primaryAction}>
                            {isTransactionMode ? 'Retry Transaction Signature' : 'Retry Handshake Connection'}
                        </button>
                        <div className="status-msg error">
                            <span>!</span> {errorMessage}
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
            <span className="logo-icon">GP</span>
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
