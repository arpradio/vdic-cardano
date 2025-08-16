export interface PinningService {
  id: string;
  name: string;
  endpoint: string;
  accessToken: string;
  type: 'ipfs-pinning-service' | 'custom';
  verified: boolean;
  enabled: boolean;
}

export interface DatastoreItem {
  cid: string;
  name: string;
  size: number;
  type: string;
  contentType: 'text' | 'image' | 'video' | 'audio' | 'binary';
  mimeType: string;
  timestamp: number;
  encrypted: boolean;
  sharded: boolean;
  shardCount?: number;
  encryptionKey?: string;
  pinned: string[];
  verified: boolean;
  downloadCount: number;
  metadata?: Record<string, any>;
}

export interface ShardingConfig {
  enabled: boolean;
  chunkSize: number;
  maxShards: number;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'AES-GCM' | 'AES-CTR';
  keyLength: 128 | 256;
  generateKey: boolean;
  customKey?: string;
}

export interface NodeConfig {
  bootstrapPeers: string[];
  enableDiscovery: boolean;
  maxConnections: number;
}

export interface AppSettings {
  autoSave: boolean;
  exportFormat: 'car' | 'json';
  theme: 'dark' | 'light';
}

export interface PersistentConfig {
  version: string;
  initialized: boolean;
  datastore: DatastoreItem[];
  pinningServices: PinningService[];
  shardingConfig: ShardingConfig;
  encryptionConfig: EncryptionConfig;
  nodeConfig: NodeConfig;
  appSettings: AppSettings;
}

export interface HeliaNode {
  id: string;
  libp2p: any;
  blockstore: any;
  datastore: any;
}

export interface FileProcessingResult {
  data: Uint8Array;
  contentType: 'text' | 'image' | 'video' | 'audio' | 'binary';
  mimeType: string;
  size: number;
  metadata?: Record<string, any>;
}

export interface EncryptionResult {
  encrypted: Uint8Array;
  iv: Uint8Array;
}