import React from 'react';

export default function HomePage() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      fontFamily: 'sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🛡️</div>
      <h1 style={{ marginBottom: '12px' }}>Ghost Persona Companion</h1>
      <p style={{ color: '#666', maxWidth: '500px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
        Securely bridging your local development workspace with decentralized identity networks via Story Protocol.
      </p>
      <div style={{ 
        fontSize: '14px', 
        color: '#888', 
        background: '#f5f5f5', 
        padding: '12px 20px', 
        borderRadius: '6px',
        border: '1px solid #eaeaea'
      }}>
        To authenticate, trigger the companion setup flow directly inside your VS Code extension.
      </div>
    </div>
  );
}