import { CIDOptions } from './cid-options';
import { IPFSManager } from './ipfs-manager';
import { FileOperations } from './file-operations';
import { ConfigManager } from './config-manager';
import { Logger } from './logger';
import { CacheManager } from './cache-manager';
import { PerformanceMonitor } from './performance-monitor';
import { ErrorHandler } from './error-handler';

export interface IPFSClientConfig {
  cidOptions?: CIDOptions;
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    enableConsoleOutput?: boolean;
    enablePersistence?: boolean;
  };
  cache?: {
    maxSize?: number;
    defaultTTL?: number;
    enableCompression?: boolean;
  };
  performance?: {
    enableMonitoring?: boolean;
    metricsRetentionTime?: number;
  };
  errorHandling?: {
    enableAutoRecovery?: boolean;
    maxRetries?: number;
    retryDelays?: number[];
  };
}





export { ContentTypeHandler } from './content-handler';
export { CryptoUtils } from './crypto-utils';
export { ShardingUtils } from './sharding-utils';
export { IPFSManager } from './ipfs-manager';
export { FileOperations } from './file-operations';
export { PinningManager } from './pinning-manager';
export { ConfigManager } from './config-manager';
export { StreamUtils } from './stream-utils';
export { ValidationUtils } from './validation-utils';
export { Logger } from './logger';
export { CARHandler } from './car-handler';
export { SearchFilter } from './search-filter';
export { PerformanceMonitor } from './performance-monitor';
export { ErrorHandler } from './error-handler';
export { CacheManager } from './cache-manager';
export { UsageExamples } from './usage-examples';

export { default as ModularHeliaClient } from './modular-helia-client';
export { default as EnhancedHeliaClient } from './enhanced-helia-client';

export const IPFS_CLIENT_VERSION = '2.0.0';

export interface IPFSClientConfig {
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    enableConsoleOutput?: boolean;
    enablePersistence?: boolean;
  };
  cache?: {
    maxSize?: number;
    defaultTTL?: number;
    enableCompression?: boolean;
  };
  performance?: {
    enableMonitoring?: boolean;
    metricsRetentionTime?: number;
  };
  errorHandling?: {
    enableAutoRecovery?: boolean;
    maxRetries?: number;
    retryDelays?: number[];
  };
}

export class IPFSClientSDK {
  private static instance: IPFSClientSDK;
  private initialized = false;

  static getInstance(): IPFSClientSDK {
    if (!IPFSClientSDK.instance) {
      IPFSClientSDK.instance = new IPFSClientSDK();
    }
    return IPFSClientSDK.instance;
  }

  async initialize(config: IPFSClientConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn('IPFS Client SDK already initialized');
      return;
    }

    try {
      Logger.getInstance(config.logging);
      
      CacheManager.getInstance(config.cache);
      
      if (config.performance?.enableMonitoring !== false) {
        PerformanceMonitor.getInstance();
      }
      
      ErrorHandler.getInstance(config.errorHandling);
      
      await IPFSManager.loadLibraries();
      
      this.initialized = true;
      
      const logger = Logger.getInstance();
      logger.info(`IPFS Client SDK v${IPFS_CLIENT_VERSION} initialized successfully`, 'sdk');
      
    } catch (error) {
      const errorHandler = ErrorHandler.getInstance();
      await errorHandler.handleError(
        error,
        { operation: 'sdk-initialization' },
        'system'
      );
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getVersion(): string {
    return IPFS_CLIENT_VERSION;
  }

  async createNode(nodeConfig?: any) {
    if (!this.initialized) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }
    
    const config = nodeConfig || ConfigManager.getDefaultConfig().nodeConfig;
    return await IPFSManager.createNode(config);
  }

  getLogger() {
    return Logger.getInstance();
  }

  getCache() {
    return CacheManager.getInstance();
  }

  getPerformanceMonitor() {
    return PerformanceMonitor.getInstance();
  }

  getErrorHandler() {
    return ErrorHandler.getInstance();
  }

  async uploadFile(
    file: File,
    options: {
      encrypt?: boolean;
      shard?: boolean;
      onProgress?: (message: string) => void;
    } = {}
  ) {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    const config = ConfigManager.loadConfig();
    
    if (options.encrypt !== undefined) {
      config.encryptionConfig.enabled = options.encrypt;
    }
    
    if (options.shard !== undefined) {
      config.shardingConfig.enabled = options.shard;
    }

    return await FileOperations.uploadFile(
      file,
      config.encryptionConfig,
      config.shardingConfig,
      options.onProgress
    );
  }

  async downloadFile(
    cid: string,
    options: {
      decrypt?: boolean;
      onProgress?: (message: string) => void;
    } = {}
  ) {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    const config = ConfigManager.loadConfig();
    const item = config.datastore.find(item => item.cid === cid);
    
    if (!item) {
      throw new Error(`File with CID ${cid} not found in datastore`);
    }

    return await FileOperations.downloadFile(
      item,
      config.encryptionConfig,
      options.onProgress
    );
  }

  async searchFiles(query: any) {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    const config = ConfigManager.loadConfig();
    return SearchFilter.search(config.datastore, query);
  }

  async pinFile(cid: string, serviceId: string) {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    const config = ConfigManager.loadConfig();
    const item = config.datastore.find(item => item.cid === cid);
    const service = config.pinningServices.find(s => s.id === serviceId);
    
    if (!item) {
      throw new Error(`File with CID ${cid} not found`);
    }
    
    if (!service) {
      throw new Error(`Pinning service with ID ${serviceId} not found`);
    }

    return await PinningManager.pinFile(item, service);
  }

  async exportCAR(cids: string[] = []) {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    const config = ConfigManager.loadConfig();
    let items = config.datastore;
    
    if (cids.length > 0) {
      items = items.filter(item => cids.includes(item.cid));
    }

    return await CARHandler.exportToCAR(items);
  }

  async importCAR(carData: Uint8Array) {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    const config = ConfigManager.loadConfig();
    return await CARHandler.importFromCAR(carData, config.datastore);
  }

  getStats() {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    const config = ConfigManager.loadConfig();
    const performanceStats = PerformanceMonitor.getInstance().getSystemStats();
    const cacheStats = CacheManager.getInstance().getStats();
    const errorStats = ErrorHandler.getInstance().getErrorStats();
    const configStats = ConfigManager.getConfigStats(config);

    return {
      version: IPFS_CLIENT_VERSION,
      initialized: this.initialized,
      config: configStats,
      performance: performanceStats,
      cache: cacheStats,
      errors: errorStats
    };
  }

  async destroy() {
    if (!this.initialized) {
      return;
    }

    try {
      await IPFSManager.stopNode();
      CacheManager.getInstance().destroy();
      
      this.initialized = false;
      
      const logger = Logger.getInstance();
      logger.info('IPFS Client SDK destroyed successfully', 'sdk');
      
    } catch (error) {
      console.error('Error during SDK destruction:', error);
    }
  }
}

export const createIPFSClient = (config?: IPFSClientConfig) => {
  const sdk = IPFSClientSDK.getInstance();
  return {
    initialize: () => sdk.initialize(config),
    isInitialized: () => sdk.isInitialized(),
    uploadFile: sdk.uploadFile.bind(sdk),
    downloadFile: sdk.downloadFile.bind(sdk),
    searchFiles: sdk.searchFiles.bind(sdk),
    pinFile: sdk.pinFile.bind(sdk),
    exportCAR: sdk.exportCAR.bind(sdk),
    importCAR: sdk.importCAR.bind(sdk),
    getStats: sdk.getStats.bind(sdk),
    destroy: sdk.destroy.bind(sdk),
    getLogger: sdk.getLogger.bind(sdk),
    getCache: sdk.getCache.bind(sdk),
    getPerformanceMonitor: sdk.getPerformanceMonitor.bind(sdk),
    getErrorHandler: sdk.getErrorHandler.bind(sdk)
  };
};

export const utils = {
  ContentTypeHandler,
  CryptoUtils,
  ShardingUtils,
  ValidationUtils,
  StreamUtils
};

export const managers = {
  IPFSManager,
  ConfigManager,
  PinningManager,
  CacheManager,
  ErrorHandler,
  PerformanceMonitor
};

export const operations = {
  FileOperations,
  CARHandler,
  SearchFilter
};

export const components = {
  Logger,
  ModularHeliaClient,
  EnhancedHeliaClient
};

export default {
  IPFSClientSDK,
  createIPFSClient,
  utils,
  managers,
  operations,
  components,
  UsageExamples,
  version: IPFS_CLIENT_VERSION
};