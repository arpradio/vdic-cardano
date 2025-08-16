import { DatastoreConfig, FileMetadata, PeerConfig, PinningService } from './types';

export class StorageManager {
  private static readonly CONFIG_KEY = 'ipfs-client-config';
  private static readonly VERSION = '1.0.0';

  static getDefaultConfig(): DatastoreConfig {
    return {
      files: [],
      peers: [
        {
          id: 'bootstrap-1',
          multiaddr: '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
          name: 'Bootstrap Node 1',
          enabled: true,
          trusted: true,
          addedAt: Date.now()
        },
        {
          id: 'bootstrap-2',
          multiaddr: '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
          name: 'Bootstrap Node 2',
          enabled: true,
          trusted: true,
          addedAt: Date.now()
        }
      ],
      pinningServices: [
        {
          id: 'web3-storage',
          name: 'Web3.Storage',
          endpoint: 'https://api.web3.storage',
          accessToken: '',
          type: 'web3-storage',
          verified: false,
          enabled: false,
          addedAt: Date.now()
        },
        {
          id: 'pinata',
          name: 'Pinata',
          endpoint: 'https://api.pinata.cloud/pinning/pinJSONToIPFS',
          accessToken: '',
          type: 'pinata',
          verified: false,
          enabled: false,
          addedAt: Date.now()
        }
      ],
      encryptionDefaults: {
        enabled: false,
        algorithm: 'AES-GCM',
        keySize: 256
      },
      shardingDefaults: {
        enabled: false,
        chunkSize: 1024 * 1024,
        maxShards: 10,
        redundancy: 1
      },
      cidDefaults: {
        version: 1,
        codec: 'dag-pb',
        hasher: 'sha2-256'
      },
      version: this.VERSION,
      lastUpdated: Date.now()
    };
  }

  static saveConfig(config: DatastoreConfig): void {
    try {
      config.lastUpdated = Date.now();
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
      throw new Error('Storage quota exceeded or localStorage unavailable');
    }
  }

  static loadConfig(): DatastoreConfig {
    try {
      const stored = localStorage.getItem(this.CONFIG_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        return this.migrateConfig(config);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    return this.getDefaultConfig();
  }

  static addFile(file: FileMetadata): void {
    const config = this.loadConfig();
    const existingIndex = config.files.findIndex(f => f.cid === file.cid);
    
    if (existingIndex >= 0) {
      config.files[existingIndex] = file;
    } else {
      config.files.push(file);
    }
    
    this.saveConfig(config);
  }

  static removeFile(cid: string): void {
    const config = this.loadConfig();
    config.files = config.files.filter(f => f.cid !== cid);
    this.saveConfig(config);
  }

  static updateFile(cid: string, updates: Partial<FileMetadata>): void {
    const config = this.loadConfig();
    const fileIndex = config.files.findIndex(f => f.cid === cid);
    
    if (fileIndex >= 0) {
      config.files[fileIndex] = { ...config.files[fileIndex], ...updates };
      this.saveConfig(config);
    }
  }

  static addPeer(peer: PeerConfig): void {
    const config = this.loadConfig();
    const existingIndex = config.peers.findIndex(p => p.id === peer.id);
    
    if (existingIndex >= 0) {
      config.peers[existingIndex] = peer;
    } else {
      config.peers.push(peer);
    }
    
    this.saveConfig(config);
  }

  static removePeer(peerId: string): void {
    const config = this.loadConfig();
    config.peers = config.peers.filter(p => p.id !== peerId);
    this.saveConfig(config);
  }

  static updatePeer(peerId: string, updates: Partial<PeerConfig>): void {
    const config = this.loadConfig();
    const peerIndex = config.peers.findIndex(p => p.id === peerId);
    
    if (peerIndex >= 0) {
      config.peers[peerIndex] = { ...config.peers[peerIndex], ...updates };
      this.saveConfig(config);
    }
  }

  static addPinningService(service: PinningService): void {
    const config = this.loadConfig();
    const existingIndex = config.pinningServices.findIndex(s => s.id === service.id);
    
    if (existingIndex >= 0) {
      config.pinningServices[existingIndex] = service;
    } else {
      config.pinningServices.push(service);
    }
    
    this.saveConfig(config);
  }

  static removePinningService(serviceId: string): void {
    const config = this.loadConfig();
    config.pinningServices = config.pinningServices.filter(s => s.id !== serviceId);
    this.saveConfig(config);
  }

  static updatePinningService(serviceId: string, updates: Partial<PinningService>): void {
    const config = this.loadConfig();
    const serviceIndex = config.pinningServices.findIndex(s => s.id === serviceId);
    
    if (serviceIndex >= 0) {
      config.pinningServices[serviceIndex] = { ...config.pinningServices[serviceIndex], ...updates };
      this.saveConfig(config);
    }
  }

  static updateDefaults(updates: {
    encryption?: Partial<DatastoreConfig['encryptionDefaults']>;
    sharding?: Partial<DatastoreConfig['shardingDefaults']>;
    cid?: Partial<DatastoreConfig['cidDefaults']>;
  }): void {
    const config = this.loadConfig();
    
    if (updates.encryption) {
      config.encryptionDefaults = { ...config.encryptionDefaults, ...updates.encryption };
    }
    if (updates.sharding) {
      config.shardingDefaults = { ...config.shardingDefaults, ...updates.sharding };
    }
    if (updates.cid) {
      config.cidDefaults = { ...config.cidDefaults, ...updates.cid };
    }
    
    this.saveConfig(config);
  }

  static clearAll(): void {
    localStorage.removeItem(this.CONFIG_KEY);
  }

  static exportConfig(): string {
    const config = this.loadConfig();
    return JSON.stringify({
      ...config,
      pinningServices: config.pinningServices.map(s => ({
        ...s,
        accessToken: s.accessToken ? '[REDACTED]' : ''
      }))
    }, null, 2);
  }

  static importConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      const validatedConfig = this.migrateConfig(config);
      this.saveConfig(validatedConfig);
    } catch (error) {
      throw new Error('Invalid configuration format');
    }
  }

  private static migrateConfig(config: any): DatastoreConfig {
    const defaultConfig = this.getDefaultConfig();
    
    return {
      files: Array.isArray(config.files) ? config.files : defaultConfig.files,
      peers: Array.isArray(config.peers) ? config.peers : defaultConfig.peers,
      pinningServices: Array.isArray(config.pinningServices) ? config.pinningServices : defaultConfig.pinningServices,
      encryptionDefaults: config.encryptionDefaults || defaultConfig.encryptionDefaults,
      shardingDefaults: config.shardingDefaults || defaultConfig.shardingDefaults,
      cidDefaults: config.cidDefaults || defaultConfig.cidDefaults,
      version: this.VERSION,
      lastUpdated: Date.now()
    };
  }
}