import React, { useState, useEffect, useRef } from 'react';
import { 
  DatastoreConfig, 
  FileMetadata, 
  PeerConfig, 
  PinningService, 
  UploadOptions, 
  UploadProgress, 
  NodeStats 
} from './components/types';
import { StorageManager } from './components/storage-manager';
import { IPFSNodeManager } from './components/ipfs-node-manager';
import { FileOperationsManager } from './components/file-operations-manager';
import { PinningServiceManager } from './components/pinning-service-manager';

type TabType = 'files' | 'upload' | 'peers' | 'pinning' | 'settings';

export default function IPFSBrowserClient() {
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [config, setConfig] = useState<DatastoreConfig>(StorageManager.getDefaultConfig());
  const [nodeStats, setNodeStats] = useState<NodeStats>({
    peerId: '',
    connectedPeers: 0,
    totalFiles: 0,
    totalSize: 0,
    uptime: 0,
    status: 'initializing'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadOptions, setUploadOptions] = useState<UploadOptions>({
    version: 1,
    codec: 'dag-pb',
    hasher: 'sha2-256',
    enabled: false,
    algorithm: 'AES-GCM',
    keySize: 256,
    chunkSize: 0,
    maxShards: 10,
    redundancy: 1,
    pin: false,
    pinToServices: [],
    tags: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [newPeer, setNewPeer] = useState<Partial<PeerConfig>>({});
  const [newService, setNewService] = useState<Partial<PinningService>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ipfsManager = IPFSNodeManager.getInstance();

  useEffect(() => {
    const loadedConfig = StorageManager.loadConfig();
    setConfig(loadedConfig);
    
    initializeIPFS(loadedConfig);
  }, []);

  useEffect(() => {
    const unsubscribe = ipfsManager.onStatsUpdate((stats) => {
      setNodeStats(stats);
    });

    return () => {
      ipfsManager.offStatsUpdate(unsubscribe);
    };
  }, []);

  const initializeIPFS = async (config: DatastoreConfig) => {
    try {
      await ipfsManager.initialize(config.peers);
      ipfsManager.updateFileStats(config.files.length, 
        config.files.reduce((sum, f) => sum + f.size, 0)
      );
    } catch (error) {
      console.error('Failed to initialize IPFS:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (nodeStats.status !== 'ready') {
      alert('IPFS node is not ready. Please wait for initialization to complete.');
      return;
    }

    try {
      console.log('Starting upload process for:', selectedFile.name);
      console.log('Upload options:', uploadOptions);
      console.log('Node status:', nodeStats.status);
      
      setUploadProgress({ stage: 'preparing', progress: 0, message: 'Preparing...' });
      
      const result = await FileOperationsManager.uploadFile(
        selectedFile,
        uploadOptions,
        setUploadProgress
      );

      console.log('Upload result:', result);

      if (result.success && result.file) {
        const updatedConfig = StorageManager.loadConfig();
        setConfig(updatedConfig);
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadProgress(null);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Show success message with CID info
        const requestedVersion = uploadOptions.version;
        const actualVersion = result.file.cidVersion;
        
        if (requestedVersion !== actualVersion) {
          alert(`File uploaded successfully!\n\nNote: Generated CID v${actualVersion} (you requested v${requestedVersion})\nThis is normal for compatibility reasons.`);
        } else {
          alert(`File uploaded successfully with CID v${actualVersion}!`);
        }
      } else {
        console.error('Upload failed:', result.error);
        setUploadProgress({
          stage: 'error',
          progress: 0,
          message: 'Upload failed',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      setUploadProgress({
        stage: 'error',
        progress: 0,
        message: 'Upload failed',
        error: errorMessage
      });
    }
  };

  const handleDownload = async (file: FileMetadata) => {
    try {
      const result = await FileOperationsManager.downloadFile(file);
      
      if (result.success && result.data) {
        FileOperationsManager.downloadBlob(result.data, file.name, file.mimeType);
        const updatedConfig = StorageManager.loadConfig();
        setConfig(updatedConfig);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDeleteFile = async (cid: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      await FileOperationsManager.deleteFile(cid);
      const updatedConfig = StorageManager.loadConfig();
      setConfig(updatedConfig);
    }
  };

  const handleAddPeer = () => {
    if (newPeer.multiaddr && newPeer.name) {
      const peer: PeerConfig = {
        id: `peer-${Date.now()}`,
        multiaddr: newPeer.multiaddr,
        name: newPeer.name,
        enabled: true,
        trusted: false,
        addedAt: Date.now()
      };
      
      StorageManager.addPeer(peer);
      setConfig(StorageManager.loadConfig());
      setNewPeer({});
      setShowPeerModal(false);
    }
  };

  const handleTestService = async (service: PinningService) => {
    const result = await PinningServiceManager.testService(service);
    
    StorageManager.updatePinningService(service.id, {
      verified: result.verified
    });
    
    setConfig(StorageManager.loadConfig());
    
    if (!result.verified && result.error) {
      alert(`Service test failed: ${result.error}`);
    }
  };

  const handleAddService = () => {
    if (newService.name && newService.endpoint && newService.accessToken && newService.type) {
      const service: PinningService = {
        id: `service-${Date.now()}`,
        name: newService.name,
        endpoint: newService.endpoint,
        accessToken: newService.accessToken,
        type: newService.type,
        verified: false,
        enabled: false,
        addedAt: Date.now()
      };
      
      StorageManager.addPinningService(service);
      setConfig(StorageManager.loadConfig());
      setNewService({});
      setShowServiceModal(false);
    }
  };

  const filteredFiles = config.files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ready': return 'text-green-400';
      case 'initializing': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const TabButton = ({ tab, children }: { tab: TabType; children: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
        activeTab === tab
          ? 'bg-blue-600 text-white border-b-2 border-blue-400'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-blue-400 mb-4">IPFS Browser Client</h1>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Status:</span>
              <span className={`ml-2 font-medium ${getStatusColor(nodeStats.status)}`}>
                {nodeStats.status}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Peers:</span>
              <span className="ml-2 font-medium text-green-400">{nodeStats.connectedPeers}</span>
            </div>
            <div>
              <span className="text-gray-400">Files:</span>
              <span className="ml-2 font-medium text-blue-400">{nodeStats.totalFiles}</span>
            </div>
            <div>
              <span className="text-gray-400">Storage:</span>
              <span className="ml-2 font-medium text-purple-400">{formatBytes(nodeStats.totalSize)}</span>
            </div>
          </div>
          {nodeStats.peerId && (
            <div className="mt-2 text-xs font-mono text-gray-400">
              Peer ID: {nodeStats.peerId.slice(0, 40)}...
            </div>
          )}
        </div>
      </header>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-700 overflow-x-auto">
          <TabButton tab="files">📁 Files</TabButton>
          <TabButton tab="upload">⬆️ Upload</TabButton>
          <TabButton tab="peers">🌐 Peers</TabButton>
          <TabButton tab="pinning">📌 Pinning</TabButton>
          <TabButton tab="settings">⚙️ Settings</TabButton>
        </div>

        <div className="p-6">
          {activeTab === 'files' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-100">File Datastore</h2>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                  />
                  <button
                    onClick={() => {
                      console.log('=== FILE STORAGE REPORT ===');
                      console.log('Total files:', config.files.length);
                      console.log('Storage used:', formatBytes(config.files.reduce((sum, f) => sum + f.size, 0)));
                      console.log('Files by type:', config.files.reduce((acc, f) => {
                        acc[f.contentType] = (acc[f.contentType] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>));
                      console.log('CID versions:', config.files.reduce((acc, f) => {
                        const version = `v${f.cidVersion}`;
                        acc[version] = (acc[version] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>));
                      console.log('All files:', config.files);
                      alert('File storage report logged to console!');
                    }}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                  >
                    📊 Storage Report
                  </button>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
                  >
                    Upload File
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-6xl mb-4">📂</div>
                    <p className="text-xl mb-2">No files found</p>
                    <p>Upload your first file to get started</p>
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <div key={file.cid} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">{file.name}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-300">
                            <div>Size: {formatBytes(file.size)}</div>
                            <div>Type: {file.contentType}</div>
                            <div>
                              <span className={file.cidVersion === 1 ? 'text-green-400' : 'text-yellow-400'}>
                                CID v{file.cidVersion}
                              </span>
                            </div>
                            <div>Downloads: {file.downloadCount}</div>
                            <div className="text-xs text-gray-400">Hash: {file.hasher}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {file.encrypted && <span className="bg-red-600 px-2 py-1 rounded text-xs">🔒 Encrypted</span>}
                            {file.sharded && <span className="bg-orange-600 px-2 py-1 rounded text-xs">🧩 Sharded</span>}
                            {file.pinned.length > 0 && <span className="bg-green-600 px-2 py-1 rounded text-xs">📌 Pinned ({file.pinned.length})</span>}
                            {file.tags.map(tag => (
                              <span key={tag} className="bg-blue-600 px-2 py-1 rounded text-xs">#{tag}</span>
                            ))}
                          </div>
                          <div className="text-xs font-mono text-gray-400 mt-2 flex items-center">
                            <span className="mr-2">CID: {file.cid.slice(0, 40)}...</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(file.cid).then(() => {
                                  alert('CID copied to clipboard!');
                                }).catch(() => {
                                  console.log('Full CID:', file.cid);
                                  alert('CID logged to console (clipboard unavailable)');
                                });
                              }}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Uploaded: {new Date(file.uploadedAt).toLocaleDateString()} • 
                            Last accessed: {new Date(file.lastAccessedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => {
                              console.log('=== FILE DETAILS ===');
                              console.log('Name:', file.name);
                              console.log('CID:', file.cid);
                              console.log('Size:', formatBytes(file.size));
                              console.log('Content Type:', file.contentType);
                              console.log('MIME Type:', file.mimeType);
                              console.log('CID Version:', file.cidVersion);
                              console.log('Hasher:', file.hasher);
                              console.log('Uploaded:', new Date(file.uploadedAt).toLocaleString());
                              console.log('Last Accessed:', new Date(file.lastAccessedAt).toLocaleString());
                              console.log('Download Count:', file.downloadCount);
                              console.log('Encrypted:', file.encrypted);
                              console.log('Sharded:', file.sharded);
                              if (file.shardCount) console.log('Shard Count:', file.shardCount);
                              console.log('Pinned Services:', file.pinned);
                              console.log('Tags:', file.tags);
                              if (file.description) console.log('Description:', file.description);
                              console.log('Verified:', file.verified);
                              console.log('Full metadata:', file);
                              alert(`File details for "${file.name}" logged to console!`);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleDownload(file)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.cid)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-6">Upload File</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">File Selection</h3>
                  <div className="bg-gray-700 rounded-lg p-6 border-2 border-dashed border-gray-600">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="w-full p-3 bg-gray-600 border border-gray-500 rounded text-gray-100 file-input"
                    />
                    {selectedFile && (
                      <div className="mt-4 p-3 bg-gray-600 rounded">
                        <div className="font-medium">{selectedFile.name}</div>
                        <div className="text-sm text-gray-300">
                          {formatBytes(selectedFile.size)} • {selectedFile.type}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Upload Options</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">CID Version</label>
                      <select
                        value={uploadOptions.version}
                        onChange={(e) => setUploadOptions({...uploadOptions, version: parseInt(e.target.value) as 0 | 1})}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                      >
                        <option value={0}>CID v0 (legacy, QmXXX...)</option>
                        <option value={1}>CID v1 (recommended, bafXXX...)</option>
                      </select>
                      <div className="text-xs text-gray-400 mt-1">
                        {uploadOptions.version === 0 ? (
                          <span className="text-yellow-400">
                            ⚠️ CID v0 requires dag-pb + sha2-256. Helia may override to v1 if incompatible.
                          </span>
                        ) : (
                          <span className="text-green-400">
                            ✅ CID v1 supports all hash algorithms and raw leaves.
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Hash Algorithm</label>
                      <select
                        value={uploadOptions.hasher}
                        onChange={(e) => setUploadOptions({...uploadOptions, hasher: e.target.value as any})}
                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                      >
                        <option value="sha2-256">SHA2-256 (default)</option>
                        <option value="sha2-512">SHA2-512</option>
                        <option value="blake2b-256">Blake2b-256</option>
                        <option value="blake3">Blake3</option>
                      </select>
                      <div className="text-xs text-gray-400 mt-1">
                        {uploadOptions.version === 0 && uploadOptions.hasher !== 'sha2-256' ? (
                          <span className="text-yellow-400">
                            ⚠️ CID v0 only supports SHA2-256. Selection may be ignored.
                          </span>
                        ) : (
                          <span>
                            Hasher selection uses Helia defaults for compatibility
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={uploadOptions.enabled}
                        onChange={(e) => setUploadOptions({...uploadOptions, enabled: e.target.checked})}
                        className="rounded"
                      />
                      <label className="text-sm font-medium">Enable Encryption</label>
                    </div>

                    {uploadOptions.enabled && (
                      <div className="pl-6 space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Algorithm</label>
                          <select
                            value={uploadOptions.algorithm}
                            onChange={(e) => setUploadOptions({...uploadOptions, algorithm: e.target.value as any})}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                          >
                            <option value="AES-GCM">AES-GCM</option>
                            <option value="ChaCha20-Poly1305">ChaCha20-Poly1305</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Key Size</label>
                          <select
                            value={uploadOptions.keySize}
                            onChange={(e) => setUploadOptions({...uploadOptions, keySize: parseInt(e.target.value) as any})}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                          >
                            <option value={128}>128-bit</option>
                            <option value={256}>256-bit</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={uploadOptions.enabled && uploadOptions.chunkSize > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUploadOptions({
                              ...uploadOptions, 
                              enabled: true, 
                              chunkSize: 1024 * 1024,
                              maxShards: 10,
                              redundancy: 1
                            });
                          } else {
                            setUploadOptions({...uploadOptions, chunkSize: 0});
                          }
                        }}
                        className="rounded"
                      />
                      <label className="text-sm font-medium">Enable Sharding (for large files)</label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={uploadOptions.pin || false}
                        onChange={(e) => setUploadOptions({...uploadOptions, pin: e.target.checked})}
                        className="rounded"
                      />
                      <label className="text-sm font-medium">Pin to Services</label>
                    </div>
                  </div>

                  {selectedFile && (
                    <button
                      onClick={handleUpload}
                      disabled={!!uploadProgress || nodeStats.status !== 'ready'}
                      className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium"
                    >
                      {uploadProgress 
                        ? `${uploadProgress.stage} (${uploadProgress.progress}%)` 
                        : nodeStats.status !== 'ready'
                        ? `IPFS Node ${nodeStats.status}...`
                        : 'Upload File'
                      }
                    </button>
                  )}
                </div>
              </div>

              {uploadProgress && (
                <div className="mt-6 bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{uploadProgress.message}</span>
                    <span>{uploadProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.progress}%` }}
                    />
                  </div>
                  {uploadProgress.error && (
                    <div className="mt-2 text-red-400 text-sm">{uploadProgress.error}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'peers' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-100">Peer Management</h2>
                <button
                  onClick={() => setShowPeerModal(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                >
                  Add Peer
                </button>
              </div>

              <div className="grid gap-4">
                {config.peers.map((peer) => (
                  <div key={peer.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{peer.name}</h3>
                        <div className="text-sm text-gray-300 font-mono">{peer.multiaddr}</div>
                        <div className="flex space-x-2 mt-2">
                          {peer.enabled && <span className="bg-green-600 px-2 py-1 rounded text-xs">Enabled</span>}
                          {peer.trusted && <span className="bg-blue-600 px-2 py-1 rounded text-xs">Trusted</span>}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            StorageManager.updatePeer(peer.id, { enabled: !peer.enabled });
                            setConfig(StorageManager.loadConfig());
                          }}
                          className={`px-3 py-1 rounded text-sm ${
                            peer.enabled 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {peer.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => {
                            StorageManager.removePeer(peer.id);
                            setConfig(StorageManager.loadConfig());
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pinning' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-100">Pinning Services</h2>
                <button
                  onClick={() => setShowServiceModal(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                >
                  Add Service
                </button>
              </div>

              <div className="grid gap-4">
                {config.pinningServices.map((service) => (
                  <div key={service.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        <div className="text-sm text-gray-300">{service.endpoint}</div>
                        <div className="flex space-x-2 mt-2">
                          {service.enabled && <span className="bg-green-600 px-2 py-1 rounded text-xs">Enabled</span>}
                          {service.verified && <span className="bg-blue-600 px-2 py-1 rounded text-xs">Verified</span>}
                          <span className="bg-gray-600 px-2 py-1 rounded text-xs">{service.type}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleTestService(service)}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => {
                            StorageManager.updatePinningService(service.id, { enabled: !service.enabled });
                            setConfig(StorageManager.loadConfig());
                          }}
                          className={`px-3 py-1 rounded text-sm ${
                            service.enabled 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {service.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-6">Settings</h2>
              
              <div className="space-y-6">
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Configuration</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Config Version: {config.version}</div>
                    <div>Last Updated: {new Date(config.lastUpdated).toLocaleString()}</div>
                    <div>Total Files: {config.files.length}</div>
                    <div>Active Peers: {config.peers.filter(p => p.enabled).length}</div>
                    <div>Pinning Services: {config.pinningServices.filter(s => s.enabled).length}</div>
                    <div>Storage Used: {formatBytes(config.files.reduce((sum, f) => sum + f.size, 0))}</div>
                  </div>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">File Storage Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">By Content Type:</div>
                      {Object.entries(config.files.reduce((acc, f) => {
                        acc[f.contentType] = (acc[f.contentType] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)).map(([type, count]) => (
                        <div key={type} className="ml-2">{type}: {count}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-gray-400">By CID Version:</div>
                      {Object.entries(config.files.reduce((acc, f) => {
                        const version = `v${f.cidVersion}`;
                        acc[version] = (acc[version] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)).map(([version, count]) => (
                        <div key={version} className="ml-2">{version}: {count}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-gray-400">Special Properties:</div>
                      <div className="ml-2">Encrypted: {config.files.filter(f => f.encrypted).length}</div>
                      <div className="ml-2">Sharded: {config.files.filter(f => f.sharded).length}</div>
                      <div className="ml-2">Pinned: {config.files.filter(f => f.pinned.length > 0).length}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Data Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        const configJson = StorageManager.exportConfig();
                        const blob = new Blob([configJson], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'ipfs-config.json';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
                    >
                      Export Configuration
                    </button>
                    
                    <button
                      onClick={() => {
                        const fileList = config.files.map(f => ({
                          name: f.name,
                          cid: f.cid,
                          size: formatBytes(f.size),
                          type: f.contentType,
                          cidVersion: f.cidVersion,
                          uploaded: new Date(f.uploadedAt).toLocaleDateString()
                        }));
                        
                        const csv = [
                          'Name,CID,Size,Type,CID Version,Uploaded',
                          ...fileList.map(f => `"${f.name}","${f.cid}","${f.size}","${f.type}","v${f.cidVersion}","${f.uploaded}"`)
                        ].join('\n');
                        
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'ipfs-file-list.csv';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                    >
                      Export File List
                    </button>
                    
                    <button
                      onClick={() => {
                        const cidList = config.files.map(f => f.cid).join('\n');
                        navigator.clipboard.writeText(cidList).then(() => {
                          alert(`Copied ${config.files.length} CIDs to clipboard!`);
                        }).catch(() => {
                          console.log('All CIDs:', cidList);
                          alert('All CIDs logged to console (clipboard unavailable)');
                        });
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium"
                    >
                      Copy All CIDs
                    </button>
                    
                    <button
                      onClick={() => {
                        if (confirm('This will reset all configuration. Are you sure?')) {
                          StorageManager.clearAll();
                          setConfig(StorageManager.getDefaultConfig());
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
                    >
                      Reset Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPeerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Peer</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Peer Name"
                value={newPeer.name || ''}
                onChange={(e) => setNewPeer({...newPeer, name: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              />
              <input
                type="text"
                placeholder="Multiaddr (e.g., /ip4/...)"
                value={newPeer.multiaddr || ''}
                onChange={(e) => setNewPeer({...newPeer, multiaddr: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              />
              <div className="flex space-x-3">
                <button
                  onClick={handleAddPeer}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                >
                  Add Peer
                </button>
                <button
                  onClick={() => {
                    setShowPeerModal(false);
                    setNewPeer({});
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Pinning Service</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Service Name"
                value={newService.name || ''}
                onChange={(e) => setNewService({...newService, name: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              />
              <input
                type="text"
                placeholder="API Endpoint"
                value={newService.endpoint || ''}
                onChange={(e) => setNewService({...newService, endpoint: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              />
              <input
                type="password"
                placeholder="Access Token"
                value={newService.accessToken || ''}
                onChange={(e) => setNewService({...newService, accessToken: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              />
              <select
                value={newService.type || ''}
                onChange={(e) => setNewService({...newService, type: e.target.value as any})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
              >
                <option value="">Select Service Type</option>
                <option value="web3-storage">Web3.Storage</option>
                <option value="pinata">Pinata</option>
                <option value="ipfs-pinning-service">IPFS Pinning Service</option>
                <option value="custom">Custom</option>
              </select>
              <div className="flex space-x-3">
                <button
                  onClick={handleAddService}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                >
                  Add Service
                </button>
                <button
                  onClick={() => {
                    setShowServiceModal(false);
                    setNewService({});
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}