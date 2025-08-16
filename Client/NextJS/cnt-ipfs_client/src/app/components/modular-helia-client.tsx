'use client';

import { useState, useEffect, useRef } from 'react';
import { PersistentConfig, DatastoreItem, PinningService } from './interfaces';
import { IPFSManager } from './ipfs-manager';
import { FileOperations } from './file-operations';
import { PinningManager } from './pinning-manager';
import { ConfigManager } from './config-manager';
import { CID } from 'multiformats/cid';
import { CIDOptions, CIDOptionsManager } from './cid-options';
import { ContentTypeHandler } from './content-handler';

export default function ModularHeliaClient() {
  const [config, setConfig] = useState<PersistentConfig>(ConfigManager.getDefaultConfig());
  const [status, setStatus] = useState<string>('Loading libraries...');
  const [logs, setLogs] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'files' | 'pins' | 'config' | 'datastore'>('files');
  const [peerId, setPeerId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const updateConfig = (updates: Partial<PersistentConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    if (config.appSettings.autoSave) {
      ConfigManager.saveConfig(newConfig);
    }
  };

  const handlePeerConnect = (peerCount: number) => {
    setConnectedPeers(peerCount);
 
  };

  const handlePeerDisconnect = (peerCount: number) => {
    setConnectedPeers(peerCount);
  
  };

  useEffect(() => {
    setIsClient(true);
    addLog('Starting modular IPFS client...');
    
    ConfigManager.cleanupOldConfigs();
    const initializedConfig = ConfigManager.initializeConfig();
    setConfig(initializedConfig);
    
    addLog(initializedConfig.initialized 
      ? 'Loaded existing configuration' 
      : 'Generated new default configuration'
    );
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const initializeSystem = async () => {
      try {
        addLog('Loading IPFS libraries...');
        const loaded = await IPFSManager.loadLibraries();
        
        if (!loaded) {
          setStatus('Failed to load libraries');
          addLog('Library loading failed');
          return;
        }

        setLibrariesLoaded(true);
        addLog('Libraries loaded successfully');
        setStatus('Initializing Helia node...');

        addLog('Creating IPFS node...');
        const node = await IPFSManager.createNode(config.nodeConfig);
        
        const currentPeerId = IPFSManager.getPeerId();
        setPeerId(currentPeerId);
        addLog(`Generated peer ID: ${currentPeerId.slice(0, 20)}...`);

        IPFSManager.setupEventListeners(handlePeerConnect, handlePeerDisconnect);

        setStatus('Ready');
        addLog('Helia node initialized successfully');
        addLog(`Loaded ${config.datastore.length} files from persistent datastore`);
      } catch (err) {
        console.error('Failed to init system:', err);
        setStatus('Failed to initialize');
        addLog(`Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    initializeSystem();
  }, [isClient, config.nodeConfig]);

  useEffect(() => {
    if (config.initialized && config.appSettings.autoSave) {
      ConfigManager.saveConfig(config);
    }
  }, [config]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) {
      addLog('No file selected or upload in progress');
      return;
    }

    setIsUploading(true);
    addLog(`Starting upload: ${file.name}`);

    try {
      const result = await FileOperations.uploadFile(
        file,
        config.encryptionConfig,
        config.shardingConfig,
        addLog
      );

      if (result.success && result.item) {
        updateConfig({
          datastore: [...config.datastore, result.item]
        });
        addLog(`Upload completed successfully`);
      } else {
        addLog(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      addLog(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (item: DatastoreItem) => {
    addLog(`Starting download: ${item.name}`);

    try {
      const result = await FileOperations.downloadFile(item, config.encryptionConfig, addLog);

      if (result.success && result.data) {
        FileOperations.createDownloadLink(result.data, item.name, result.mimeType || item.type);
        
        const updatedItem = { ...item, downloadCount: item.downloadCount + 1 };
        const updatedDatastore = config.datastore.map(i => i.cid === item.cid ? updatedItem : i);
        updateConfig({ datastore: updatedDatastore });
        
        addLog(`Download completed: ${item.name}`);
      } else {
        addLog(`Download failed: ${result.error}`);
      }
    } catch (error) {
      addLog(`Download error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleVerify = async (item: DatastoreItem) => {
    addLog(`Verifying ${item.name}...`);

    try {
      const verified = await FileOperations.verifyFile(item);
      
      const updatedItem = { ...item, verified };
      const updatedDatastore = config.datastore.map(i => i.cid === item.cid ? updatedItem : i);
      updateConfig({ datastore: updatedDatastore });
      
      addLog(`Verification ${verified ? 'successful' : 'failed'}: ${item.name}`);
    } catch (error) {
      addLog(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePin = async (item: DatastoreItem, service: PinningService) => {
    addLog(`Pinning ${item.name} to ${service.name}...`);

    try {
      const result = await PinningManager.pinFile(item, service, addLog);

      if (result.success) {
        const updatedItem = { ...item, pinned: [...item.pinned, service.id] };
        const updatedDatastore = config.datastore.map(i => i.cid === item.cid ? updatedItem : i);
        updateConfig({ datastore: updatedDatastore });
      }
    } catch (error) {
      addLog(`Pin error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestService = async (service: PinningService) => {
    addLog(`Testing ${service.name}...`);

    try {
      const result = await PinningManager.testService(service);
      
      const updatedServices = config.pinningServices.map(s => 
        s.id === service.id ? { ...s, verified: result.verified } : s
      );
      updateConfig({ pinningServices: updatedServices });
      
      addLog(`${service.name} test: ${result.verified ? 'SUCCESS' : 'FAILED'} ${result.error ? `(${result.error})` : ''}`);
    } catch (error) {
      addLog(`Service test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteFile = (item: DatastoreItem) => {
    if (confirm(`Delete ${item.name}?`)) {
      const updatedDatastore = config.datastore.filter(i => i.cid !== item.cid);
      updateConfig({ datastore: updatedDatastore });
      addLog(`Deleted ${item.name} from datastore`);
    }
  };

  const handleSaveConfig = () => {
    const saved = ConfigManager.saveConfig(config);
    addLog(saved ? 'Configuration saved successfully' : 'Failed to save configuration');
  };

  const handleResetConfig = () => {
    if (confirm('Reset all configuration to defaults? This cannot be undone.')) {
      const newConfig = ConfigManager.resetConfig();
      setConfig(newConfig);
      addLog('Configuration reset to defaults');
    }
  };

  const handleExportConfig = () => {
    try {
      const exported = ConfigManager.exportConfig(config);
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ipfs-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog('Configuration exported successfully');
    } catch (error) {
      addLog(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (!isClient || !librariesLoaded) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-400 mb-8">Modular IPFS Client</h1>
          <div className="text-yellow-400 mb-4">
            {!isClient ? 'Initializing client...' : 'Loading IPFS libraries...'}
          </div>
          <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300 ${librariesLoaded ? 'w-full' : 'w-1/3'}`} />
          </div>
        </div>
      </div>
    );
  }

  const TabButton = ({ tab, children }: { tab: string; children: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab as any)}
      className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
        activeTab === tab
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'text': return '📄';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      default: return '📁';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-blue-400 mb-2">Modular IPFS Client</h1>
        <div className="flex items-center space-x-4 text-sm">
          <span className={`px-3 py-1 rounded-full ${status === 'Ready' ? 'bg-green-600' : 'bg-yellow-600'}`}>
            {status}
          </span>
          <span className="text-gray-400">Peers: {connectedPeers}</span>
          <span className="text-gray-400">Files: {config.datastore.length}</span>
          <span className="text-gray-400">Config: v{config.version}</span>
          <span className="text-gray-400 font-mono text-xs">ID: {peerId.slice(0, 20)}...</span>
        </div>
      </header>

      <div className="bg-gray-800 rounded-lg p-4 mb-8">
        <h3 className="text-green-400 font-semibold mb-2">System Logs</h3>
        <div className="bg-black rounded p-3 h-32 overflow-y-auto font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-700">
          <TabButton tab="files">Files</TabButton>
          <TabButton tab="pins">Pinning Services</TabButton>
          <TabButton tab="config">Configuration</TabButton>
          <TabButton tab="datastore">Datastore Management</TabButton>
        </div>

        <div className="p-6">
          {activeTab === 'files' && (
            <div>
              <div className="mb-8">
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-yellow-400 font-semibold mb-4">File Upload</h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="w-full p-3 bg-gray-600 border border-gray-500 rounded text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer disabled:opacity-50"
                  />
                  {isUploading && (
                    <div className="mt-2 text-yellow-400 text-sm">Upload in progress...</div>
                  )}
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg overflow-hidden">
                <h3 className="text-red-400 font-semibold p-4 border-b border-gray-600">
                  Files ({config.datastore.length} items)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-600">
                      <tr>
                        <th className="p-3 text-left">Type</th>
                        <th className="p-3 text-left">Name</th>
                        <th className="p-3 text-left">CID</th>
                        <th className="p-3 text-left">Size</th>
                        <th className="p-3 text-left">Features</th>
                        <th className="p-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.datastore.map((item, i) => (
                        <tr key={i} className="border-b border-gray-600 hover:bg-gray-600">
                          <td className="p-3 text-2xl">{getContentTypeIcon(item.contentType)}</td>
                          <td className="p-3 font-medium">{item.name}</td>
                          <td className="p-3 font-mono text-xs">{item.cid.slice(0, 20)}...</td>
                          <td className="p-3">{(item.size / 1024).toFixed(1)} KB</td>
                          <td className="p-3">
                            <div className="flex space-x-1">
                              {item.encrypted && <span className="bg-blue-600 px-2 py-1 rounded text-xs">🔒</span>}
                              {item.sharded && <span className="bg-purple-600 px-2 py-1 rounded text-xs">📦 {item.shardCount}</span>}
                              {item.verified && <span className="bg-yellow-600 px-2 py-1 rounded text-xs">✅</span>}
                              <span className="bg-gray-600 px-2 py-1 rounded text-xs">⬇ {item.downloadCount}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleDownload(item)}
                                className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => handleVerify(item)}
                                className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                              >
                                Verify
                              </button>
                              <button
                                onClick={() => handleDeleteFile(item)}
                                className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pins' && (
            <div>
              <div className="bg-gray-700 rounded-lg overflow-hidden">
                <h3 className="text-purple-400 font-semibold p-4 border-b border-gray-600">
                  Pinning Services ({config.pinningServices.filter(s => s.enabled).length} enabled)
                </h3>
                <div className="p-4">
                  {config.pinningServices.map((service, i) => (
                    <div key={i} className="bg-gray-600 rounded p-4 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">{service.name}</h4>
                        <div className="flex space-x-2">
                          {service.verified && <span className="bg-green-600 px-2 py-1 rounded text-xs">✓ Verified</span>}
                          {service.enabled && <span className="bg-blue-600 px-2 py-1 rounded text-xs">Enabled</span>}
                        </div>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">{service.endpoint}</div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleTestService(service)}
                          className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-xs"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => {
                            const updatedServices = config.pinningServices.map(s =>
                              s.id === service.id ? { ...s, enabled: !s.enabled } : s
                            );
                            updateConfig({ pinningServices: updatedServices });
                          }}
                          className={`px-3 py-1 rounded text-xs ${
                            service.enabled 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {service.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-blue-400 font-semibold text-xl mb-4">Configuration Management</h3>
                <div className="flex space-x-4">
                  <button
                    onClick={handleSaveConfig}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
                  >
                    Save Config
                  </button>
                  <button
                    onClick={handleExportConfig}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
                  >
                    Export Config
                  </button>
                  <button
                    onClick={handleResetConfig}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-green-400 font-semibold text-xl mb-4">Encryption Configuration</h3>
                <div className="space-y-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.encryptionConfig.enabled}
                      onChange={(e) => updateConfig({
                        encryptionConfig: { ...config.encryptionConfig, enabled: e.target.checked }
                      })}
                      className="w-4 h-4"
                    />
                    <span>Enable File Encryption</span>
                  </label>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Algorithm</label>
                      <select
                        value={config.encryptionConfig.algorithm}
                        onChange={(e) => updateConfig({
                          encryptionConfig: { 
                            ...config.encryptionConfig, 
                            algorithm: e.target.value as 'AES-GCM' | 'AES-CTR'
                          }
                        })}
                        className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                        disabled={!config.encryptionConfig.enabled}
                      >
                        <option value="AES-GCM">AES-GCM</option>
                        <option value="AES-CTR">AES-CTR</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Key Length</label>
                      <select
                        value={config.encryptionConfig.keyLength}
                        onChange={(e) => updateConfig({
                          encryptionConfig: { 
                            ...config.encryptionConfig, 
                            keyLength: parseInt(e.target.value) as 128 | 256
                          }
                        })}
                        className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                        disabled={!config.encryptionConfig.enabled}
                      >
                        <option value="128">128-bit</option>
                        <option value="256">256-bit</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-purple-400 font-semibold text-xl mb-4">Sharding Configuration</h3>
                <div className="space-y-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.shardingConfig.enabled}
                      onChange={(e) => updateConfig({
                        shardingConfig: { ...config.shardingConfig, enabled: e.target.checked }
                      })}
                      className="w-4 h-4"
                    />
                    <span>Enable File Sharding</span>
                  </label>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Chunk Size (bytes)</label>
                      <input
                        type="number"
                        value={config.shardingConfig.chunkSize}
                        onChange={(e) => updateConfig({
                          shardingConfig: { 
                            ...config.shardingConfig, 
                            chunkSize: parseInt(e.target.value) 
                          }
                        })}
                        className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                        disabled={!config.shardingConfig.enabled}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Shards</label>
                      <input
                        type="number"
                        value={config.shardingConfig.maxShards}
                        onChange={(e) => updateConfig({
                          shardingConfig: { 
                            ...config.shardingConfig, 
                            maxShards: parseInt(e.target.value) 
                          }
                        })}
                        className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                        disabled={!config.shardingConfig.enabled}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'datastore' && (
            <div>
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-orange-400 font-semibold text-xl mb-4">Datastore Statistics</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {Object.entries(ConfigManager.getConfigStats(config)).map(([key, value]) => (
                    <div key={key} className="bg-gray-600 rounded p-3">
                      <div className="text-sm text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                      <div className="text-lg font-semibold">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}