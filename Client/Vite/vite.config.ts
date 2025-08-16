import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      buffer: 'buffer'
    }
  },

  define: {
    global: 'globalThis',
    'process.env': {}
  },

  optimizeDeps: {
    include: [
      'buffer',
      'helia',
      '@helia/unixfs',
      'blockstore-core',
      'datastore-core',
      'multiformats',
      'uint8arrays',
      'libp2p',
      '@chainsafe/libp2p-noise',
      '@chainsafe/libp2p-yamux',
      '@libp2p/bootstrap',
      '@libp2p/identify',
      '@libp2p/ping'
    ]
  },

  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          'ipfs-core': [
            'helia',
            '@helia/unixfs',
            'blockstore-core',
            'datastore-core'
          ],
          'libp2p-core': [
            'libp2p',
            '@chainsafe/libp2p-noise',
            '@chainsafe/libp2p-yamux',
            '@libp2p/bootstrap',
            '@libp2p/identify',
            '@libp2p/ping'
          ],
          'crypto-utils': [
            'multiformats',
            'uint8arrays',
            '@multiformats/blake2'
          ]
        }
      }
    },
    commonjsOptions: {
      include: [/node_modules/]
    }
  },

  server: {
    port: 3000,
    host: true,
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },

  preview: {
    port: 3000,
    host: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },

  worker: {
    format: 'es'
  }
});