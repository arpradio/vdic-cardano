import './polyfills-setup';
import React from 'react';
import ReactDOM from 'react-dom/client';
import IPFSBrowserClient from './ipfs-browser-client';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IPFSBrowserClient />
  </React.StrictMode>
);