import React, { useState, useRef, useEffect } from 'react';
import { FileOperations, DatastoreItem } from './file-operations';
import { CIDOptions } from './cid-options';

interface EnhancedHeliaClientProps {
  config: {
    nodeConfig: any;
    encryptionConfig: any;
    shardingConfig: any;
    datastore: DatastoreItem[];
    cidOptions?: CIDOptions;
  };
  updateConfig: (updates: any) => void;
  logger: any;
  performanceMonitor: any;
}

export const EnhancedHeliaClient: React.FC<EnhancedHeliaClientProps> = ({
  config,
  updateConfig,
  logger,
  performanceMonitor
}) => {
  const [isClient, setIsClient] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const initializeSystem = async () => {
      try {
        performanceMonitor.startTiming('system-initialization');
        setStatus('Initializing Helia node...');
        logger.info('Starting system initialization', 'system');
        
        setStatus('System ready');
        logger.info('System initialization completed', 'system');
        performanceMonitor.endTiming('system-initialization', true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Initialization failed: ${errorMessage}`, 'system');
        setStatus('Failed to initialize');
        performanceMonitor.endTiming('system-initialization', false);
      }
    };

    initializeSystem();
  }, [isClient, config.nodeConfig]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) {
      logger.warn('No file selected or upload in progress', 'upload');
      return;
    }

    const timingId = performanceMonitor.startTiming('file-upload', { 
      filename: file.name, 
      size: file.size 
    });
    
    setIsUploading(true);
    logger.info(`Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'upload');

    try {
      const result = await FileOperations.uploadFile(
        file,
        config.encryptionConfig,
        config.shardingConfig,
        (message) => logger.info(message, 'upload'),
        config.cidOptions
      );

      if (result.success && result.item) {
        updateConfig({
          datastore: [...config.datastore, result.item]
        });
        logger.info(`Upload completed successfully: ${result.item.cid}`, 'upload');
        performanceMonitor.trackNetworkUsage(file.size, 'upload');
        performanceMonitor.endTiming('file-upload', true);
      } else {
        logger.error(`Upload failed: ${result.error}`, 'upload');
        performanceMonitor.endTiming('file-upload', false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Upload error: ${errorMessage}`, 'upload');
      performanceMonitor.endTiming('file-upload', false);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (item: DatastoreItem) => {
    const timingId = performanceMonitor.startTiming('file-download', { cid: item.cid });
    logger.info(`Starting download: ${item.name}`, 'download');

    try {
      const result = await FileOperations.downloadFile(
        item, 
        config.encryptionConfig, 
        (message) => logger.info(message, 'download')
      );

      if (result.success && result.data) {
        FileOperations.createDownloadLink(result.data, item.name, result.mimeType || item.type);
        
        const updatedItem = { ...item, downloadCount: item.downloadCount + 1 };
        const updatedDatastore = config.datastore.map(i => i.cid === item.cid ? updatedItem : i);
        
        updateConfig({ datastore: updatedDatastore });
        logger.info(`Download completed successfully: ${item.name}`, 'download');
        performanceMonitor.trackNetworkUsage(item.size, 'download');
        performanceMonitor.endTiming('file-download', true);
      } else {
        logger.error(`Download failed: ${result.error}`, 'download');
        performanceMonitor.endTiming('file-download', false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Download error: ${errorMessage}`, 'download');
      performanceMonitor.endTiming('file-download', false);
    }
  };

  const updateCIDOptions = (newOptions: Partial<CIDOptions>) => {
    updateConfig({
      cidOptions: {
        ...config.cidOptions,
        ...newOptions
      }
    });
  };

  return (
    <div className="enhanced-helia-client">
      <div className="status-section">
        <h3>System Status</h3>
        <p>{status}</p>
      </div>

      <div className="cid-options-section">
        <h3>CID Options</h3>
        <div className="cid-controls">
          <label>
            CID Version:
            <select 
              value={config.cidOptions?.version || 0} 
              onChange={(e) => updateCIDOptions({ version: parseInt(e.target.value) as 0 | 1 })}
            >
              <option value={0}>v0</option>
              <option value={1}>v1</option>
            </select>
          </label>
          
          <label>
            Hash Algorithm:
            <select 
              value={config.cidOptions?.hasher?.name || 'sha2-256'} 
              onChange={(e) => updateCIDOptions({ hasher: { name: e.target.value } })}
            >
              <option value="sha2-256">SHA2-256</option>
              <option value="sha2-512">SHA2-512</option>
              <option value="blake2b-256">BLAKE2b-256</option>
              <option value="blake2s-256">BLAKE2s-256</option>
            </select>
          </label>

          <label>
            Raw Leaves:
            <input 
              type="checkbox" 
              checked={config.cidOptions?.rawLeaves ?? false}
              onChange={(e) => updateCIDOptions({ rawLeaves: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className="upload-section">
        <h3>File Upload</h3>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
        {isUploading && <p>Uploading...</p>}
      </div>

      <div className="datastore-section">
        <h3>Files ({config.datastore.length})</h3>
        <div className="file-list">
          {config.datastore.map((item) => (
            <div key={item.cid} className="file-item">
              <div className="file-info">
                <strong>{item.name}</strong>
                <span>CID: {item.cid}</span>
                <span>Size: {(item.size / 1024).toFixed(1)} KB</span>
                <span>Downloads: {item.downloadCount}</span>
                {item.cidVersion && <span>CID v{item.cidVersion}</span>}
                {item.hashAlgorithm && <span>Hash: {item.hashAlgorithm}</span>}
              </div>
              <button onClick={() => handleDownload(item)}>
                Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};