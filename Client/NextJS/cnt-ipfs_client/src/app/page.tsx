'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const LoadingComponent = () => (
  <div style={{ 
    padding: '20px', 
    fontFamily: 'monospace', 
    background: '#0f1419', 
    color: '#e6e6e6', 
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column'
  }}>
    <h1 style={{ color: '#3b82f6', marginBottom: '20px' }}>VDIC Helia Client</h1>
    <div style={{ color: '#f59e0b', marginBottom: '20px' }}>
      Loading IPFS libraries...
    </div>
    <div style={{ 
      width: '200px', 
      height: '4px', 
      background: '#374151', 
      borderRadius: '2px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, #3b82f6, #10b981)',
        animation: 'pulse 2s infinite'
      }} />
    </div>
    <style jsx>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  </div>
);

// Dynamically import the Helia client with no SSR
const HeliaClient = dynamic(() => import('@/app/components/modular-helia-client'), {
  ssr: false,
  loading: LoadingComponent
});

export default function Home() {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <HeliaClient />
    </Suspense>
  );
}