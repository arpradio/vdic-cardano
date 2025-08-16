# IPFS Browser Client

A comprehensive browser-based IPFS client built with React, TypeScript, and Helia. This client provides a complete solution for managing files on IPFS with advanced features like encryption, sharding, peer management, and pinning service integration.

## Features

### 🌐 Browser IPFS Node
- Full Helia-based IPFS node running in the browser
- WebRTC and WebSocket transport support
- Configurable bootstrap peers
- Real-time peer connection monitoring

### 📁 File Management
- Upload files with drag-and-drop support
- Download files from IPFS
- File verification and integrity checking
- Support for large files through sharding
- Content type detection and categorization

### 🔒 Security & Encryption
- AES-GCM and ChaCha20-Poly1305 encryption
- Custom encryption keys or auto-generation
- Secure key storage in localStorage
- Password-based key derivation (PBKDF2)

### 🧩 File Sharding
- Automatic sharding for large files
- Configurable chunk sizes and shard limits
- Redundancy options for data protection
- Manifest-based reconstruction

### 📌 Pinning Services
- Support for multiple pinning services
- Web3.Storage, Pinata, and custom service integration
- Authentication token management
- Service verification and testing
- Bulk pinning operations

### 🎛️ Configuration Management
- Persistent configuration in localStorage
- Import/export configuration
- Peer management with trust levels
- CID version selection (v0/v1)
- Hash algorithm selection (SHA2-256, SHA2-512, Blake2b, Blake3)

### 📊 User Interface
- Modern React-based UI with Tailwind CSS
- Tabbed interface for organized functionality
- Real-time progress indicators
- File search and filtering
- Responsive design

## Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Modern browser with SharedArrayBuffer support

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd ipfs-browser-client
npm install
```

2. **Start development server:**
```bash
npm run dev
```

3. **Open in browser:**
Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── types.ts                    # Core TypeScript interfaces
├── storage-manager.ts          # localStorage configuration management
├── ipfs-node-manager.ts        # Helia IPFS node management
├── crypto-utils.ts             # Encryption/decryption utilities
├── sharding-utils.ts           # File sharding and reconstruction
├── pinning-service-manager.ts  # Pinning service integration
├── file-operations-manager.ts  # High-level file operations
├── validation-utils.ts         # Input validation and sanitization
├── content-type-utils.ts       # File type detection and MIME types
├── error-handling-utils.ts     # Comprehensive error management
└── ipfs-browser-client.tsx     # Main React component
```

## Usage Guide

### 1. Initial Setup

When you first open the application:
- The IPFS node will automatically initialize
- Default bootstrap peers will be configured
- Your unique Peer ID will be generated

### 2. Uploading Files

1. Navigate to the **Upload** tab
2. Select a file using the file input
3. Configure upload options:
   - **CID Version**: Choose v0 (legacy) or v1 (recommended)
   - **Hash Algorithm**: Select from SHA2-256, SHA2-512, Blake2b-256, or Blake3
   - **Encryption**: Enable AES-GCM or ChaCha20-Poly1305 encryption
   - **Sharding**: Enable for large files (>1MB recommended)
   - **Pinning**: Select services to pin the file

4. Click **Upload File** and monitor progress

### 3. Managing Files

In the **Files** tab:
- View all uploaded files with metadata
- Search files by name or tags
- Download files (automatically decrypted if encrypted)
- Delete files from local datastore
- View file details (CID, size, encryption status, etc.)

### 4. Peer Management

In the **Peers** tab:
- Add custom IPFS peers by multiaddr
- Enable/disable peer connections
- Mark peers as trusted
- Monitor connected peer count

### 5. Pinning Services

In the **Pinning** tab:
- Add pinning service credentials
- Test service connectivity
- Enable/disable services
- Monitor pinning status

### 6. Configuration

In the **Settings** tab:
- View system statistics
- Export configuration as JSON
- Reset all settings
- Monitor storage usage

## Advanced Features

### Custom Encryption Keys

```typescript
// Generate a custom encryption key
const customKey = await CryptoUtils.generateKey('AES-GCM', 256);

// Use with upload options
const uploadOptions = {
  enabled: true,
  algorithm: 'AES-GCM',
  keySize: 256,
  customKey: customKey
};
```

### Programmatic File Upload

```typescript
import { FileOperationsManager } from './file-operations-manager';

const result = await FileOperationsManager.uploadFile(
  file,
  {
    version: 1,
    codec: 'dag-pb',
    hasher: 'sha2-256',
    enabled: true, // encryption
    algorithm: 'AES-GCM',
    keySize: 256,
    chunkSize: 1024 * 1024, // 1MB chunks
    pin: true,
    pinToServices: ['web3-storage']
  },
  (progress) => console.log(progress)
);
```

### Adding Custom Pinning Services

```typescript
import { PinningServiceManager } from './pinning-service-manager';

const customService = {
  id: 'my-service',
  name: 'My Custom Service',
  endpoint: 'https://api.myservice.com',
  accessToken: 'your-token-here',
  type: 'custom',
  verified: false,
  enabled: true
};

// Test the service
const result = await PinningServiceManager.testService(customService);
if (result.verified) {
  StorageManager.addPinningService(customService);
}
```

## Configuration Options

### CID Options
- **Version**: 0 (legacy) or 1 (modern, base32-encoded)
- **Codec**: dag-pb, raw, or dag-cbor
- **Hasher**: sha2-256, sha2-512, blake2b-256, blake3

### Encryption Options
- **Algorithm**: AES-GCM or ChaCha20-Poly1305
- **Key Size**: 128-bit or 256-bit
- **Key Generation**: Automatic or custom

### Sharding Options
- **Chunk Size**: 64KB to 32MB (recommended: 1MB)
- **Max Shards**: Maximum number of shards per file
- **Redundancy**: Number of redundant copies (1-3)

## Browser Compatibility

### Supported Browsers
- Chrome 88+
- Firefox 79+
- Safari 14+
- Edge 88+

### Required Features
- SharedArrayBuffer support
- WebRTC DataChannels
- WebCrypto API
- Local Storage
- Web Workers

### Security Headers

For SharedArrayBuffer support, serve with these headers:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

## Troubleshooting

### Common Issues

**1. SharedArrayBuffer not available**
- Ensure proper COOP/COEP headers
- Use HTTPS in production
- Check browser compatibility

**2. Peer connection failures**
- Verify bootstrap peers are accessible
- Check firewall/network restrictions
- Try different transport protocols

**3. Large file upload timeouts**
- Enable sharding for files >10MB
- Increase chunk size for very large files
- Check available memory

**4. Pinning service errors**
- Verify API tokens are valid
- Test service connectivity
- Check service-specific documentation

### Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('debug', 'ipfs*,helia*,libp2p*');
```

## API Reference

### Storage Manager
```typescript
StorageManager.saveConfig(config: DatastoreConfig): void
StorageManager.loadConfig(): DatastoreConfig
StorageManager.addFile(file: FileMetadata): void
StorageManager.removeFile(cid: string): void
```

### IPFS Node Manager
```typescript
IPFSNodeManager.getInstance(): IPFSNodeManager
manager.initialize(peers: PeerConfig[]): Promise<void>
manager.addFile(content: Uint8Array, filename: string, options: CIDOptions): Promise<{cid: string, size: number}>
manager.getFile(cid: string): Promise<Uint8Array>
```

### File Operations Manager
```typescript
FileOperationsManager.uploadFile(file: File, options: UploadOptions, onProgress?: (progress: UploadProgress) => void): Promise<UploadResult>
FileOperationsManager.downloadFile(metadata: FileMetadata, onProgress?: (progress: UploadProgress) => void): Promise<DownloadResult>
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with TypeScript
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Security Considerations

- Encryption keys are stored in localStorage (consider more secure alternatives for production)
- Files are processed entirely in browser memory
- No server-side storage or processing
- All network requests use HTTPS
- Pinning service tokens should be rotated regularly

## Performance Notes

- Large files (>100MB) should use sharding
- Browser memory limits apply to file processing
- WebRTC connections may have bandwidth limitations
- Consider file compression before upload for optimal performance