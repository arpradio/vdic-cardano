import { PersistentConfig, ShardingConfig, EncryptionConfig, NodeConfig, AppSettings } from './interfaces';
import { PinningManager } from './pinning-manager';

export class ConfigManager {
  private static readonly CONFIG_KEY = 'ipfs-client-config-v2';
  private static readonly VERSION = '2.0.0';

  static getDefaultConfig(): PersistentConfig {
    return {
      version: this.VERSION,
      initialized: false,
      datastore: [],
      pinningServices: PinningManager.createDefaultServices(),
      shardingConfig: {
        enabled: false,
        chunkSize: 1024 * 1024,
        maxShards: 10,
      },
      encryptionConfig: {
        enabled: false,
        algorithm: 'AES-GCM',
        keyLength: 256,
        generateKey: true,
      },
      nodeConfig: {
        bootstrapPeers: [
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
        ],
        enableDiscovery: true,
        maxConnections: 50,
      },
      appSettings: {
        autoSave: true,
        exportFormat: 'car',
        theme: 'dark',
      },
    };
  }

  static saveConfig(config: PersistentConfig): boolean {
    try {
      const serialized = JSON.stringify(config, null, 2);
      localStorage.setItem(this.CONFIG_KEY, serialized);
      return true;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return false;
    }
  }

  static loadConfig(): PersistentConfig {
    try {
      const stored = localStorage.getItem(this.CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.migrateConfig(parsed);
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
    return this.getDefaultConfig();
  }

  static initializeConfig(): PersistentConfig {
    const config = this.loadConfig();
    if (!config.initialized) {
      const newConfig = {
        ...config,
        initialized: true,
        version: this.VERSION,
      };
      this.saveConfig(newConfig);
      return newConfig;
    }
    return config;
  }

  static resetConfig(): PersistentConfig {
    const newConfig = {
      ...this.getDefaultConfig(),
      initialized: true,
    };
    this.saveConfig(newConfig);
    return newConfig;
  }

  static exportConfig(config: PersistentConfig): string {
    const exportData = {
      ...config,
      datastore: config.datastore.map(item => ({
        ...item,
        encryptionKey: undefined,
      })),
    };
    return JSON.stringify(exportData, null, 2);
  }

  static importConfig(configJson: string): { success: boolean; config?: PersistentConfig; error?: string } {
    try {
      const parsed = JSON.parse(configJson);
      const migrated = this.migrateConfig(parsed);
      
      if (this.validateConfig(migrated)) {
        migrated.initialized = true;
        migrated.version = this.VERSION;
        return { success: true, config: migrated };
      } else {
        return { success: false, error: 'Invalid configuration format' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse JSON' 
      };
    }
  }

  private static migrateConfig(config: any): PersistentConfig {
    const defaultConfig = this.getDefaultConfig();
    
    const migrated: PersistentConfig = {
      version: this.VERSION,
      initialized: config.initialized || false,
      datastore: Array.isArray(config.datastore) ? config.datastore : [],
      pinningServices: Array.isArray(config.pinningServices) 
        ? config.pinningServices 
        : defaultConfig.pinningServices,
      shardingConfig: {
        ...defaultConfig.shardingConfig,
        ...(config.shardingConfig || {}),
      },
      encryptionConfig: {
        ...defaultConfig.encryptionConfig,
        ...(config.encryptionConfig || {}),
      },
      nodeConfig: {
        ...defaultConfig.nodeConfig,
        ...(config.nodeConfig || {}),
      },
      appSettings: {
        ...defaultConfig.appSettings,
        ...(config.appSettings || {}),
      },
    };

    migrated.datastore = migrated.datastore.map(item => ({
      ...item,
      contentType: item.contentType || this.inferContentType(item.type),
      mimeType: item.mimeType || item.type || 'application/octet-stream',
      metadata: item.metadata || {},
    }));

    return migrated;
  }

  private static inferContentType(mimeType: string): 'text' | 'image' | 'video' | 'audio' | 'binary' {
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      return 'text';
    }
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }
    return 'binary';
  }

  private static validateConfig(config: any): boolean {
    return !!(
      config &&
      typeof config === 'object' &&
      Array.isArray(config.datastore) &&
      Array.isArray(config.pinningServices) &&
      config.shardingConfig &&
      config.encryptionConfig &&
      config.nodeConfig &&
      config.appSettings
    );
  }

  static updateShardingConfig(config: PersistentConfig, updates: Partial<ShardingConfig>): PersistentConfig {
    return {
      ...config,
      shardingConfig: {
        ...config.shardingConfig,
        ...updates,
      },
    };
  }

  static updateEncryptionConfig(config: PersistentConfig, updates: Partial<EncryptionConfig>): PersistentConfig {
    return {
      ...config,
      encryptionConfig: {
        ...config.encryptionConfig,
        ...updates,
      },
    };
  }

  static updateNodeConfig(config: PersistentConfig, updates: Partial<NodeConfig>): PersistentConfig {
    return {
      ...config,
      nodeConfig: {
        ...config.nodeConfig,
        ...updates,
      },
    };
  }

  static updateAppSettings(config: PersistentConfig, updates: Partial<AppSettings>): PersistentConfig {
    return {
      ...config,
      appSettings: {
        ...config.appSettings,
        ...updates,
      },
    };
  }

  static cleanupOldConfigs(): void {
    try {
      const oldKeys = [
        'ipfs-client-config-v1',
        'ipfs-client-config',
        'helia-client-config',
      ];
      
      oldKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup old configurations:', error);
    }
  }

  static getConfigStats(config: PersistentConfig): Record<string, any> {
    return {
      version: config.version,
      initialized: config.initialized,
      fileCount: config.datastore.length,
      encryptedFiles: config.datastore.filter(item => item.encrypted).length,
      shardedFiles: config.datastore.filter(item => item.sharded).length,
      totalSize: config.datastore.reduce((sum, item) => sum + item.size, 0),
      activeServices: config.pinningServices.filter(service => service.enabled).length,
      verifiedServices: config.pinningServices.filter(service => service.verified).length,
      encryptionEnabled: config.encryptionConfig.enabled,
      shardingEnabled: config.shardingConfig.enabled,
      autoSaveEnabled: config.appSettings.autoSave,
    };
  }
}