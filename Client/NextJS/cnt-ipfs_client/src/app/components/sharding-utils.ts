import { ShardingConfig } from './interfaces';

export interface ShardManifest {
  name: string;
  size: number;
  shards: string[];
  encrypted: boolean;
  encryptionKey?: string;
  contentType: string;
  mimeType: string;
  timestamp: number;
  checksum: string;
}

export class ShardingUtils {
  static shardFile(data: Uint8Array, config: ShardingConfig): Uint8Array[] {
    if (!config.enabled || data.length <= config.chunkSize) {
      return [data];
    }

    const shards: Uint8Array[] = [];
    let offset = 0;
    let shardIndex = 0;

    while (offset < data.length && shardIndex < config.maxShards) {
      const end = Math.min(offset + config.chunkSize, data.length);
      shards.push(data.slice(offset, end));
      offset = end;
      shardIndex++;
    }

    if (offset < data.length) {
      const remaining = data.slice(offset);
      if (shards.length < config.maxShards) {
        shards.push(remaining);
      } else {
        const lastShard = shards[shards.length - 1];
        const combined = new Uint8Array(lastShard.length + remaining.length);
        combined.set(lastShard);
        combined.set(remaining, lastShard.length);
        shards[shards.length - 1] = combined;
      }
    }

    return shards;
  }

  static reconstructFile(shards: Uint8Array[]): Uint8Array {
    if (shards.length === 0) {
      return new Uint8Array(0);
    }

    if (shards.length === 1) {
      return shards[0];
    }

    const totalSize = shards.reduce((sum, shard) => sum + shard.length, 0);
    const reconstructed = new Uint8Array(totalSize);
    
    let offset = 0;
    for (const shard of shards) {
      reconstructed.set(shard, offset);
      offset += shard.length;
    }

    return reconstructed;
  }

  static createManifest(
    filename: string,
    originalData: Uint8Array,
    shardCids: string[],
    encrypted: boolean,
    encryptionKey: string,
    contentType: string,
    mimeType: string
  ): ShardManifest {
    return {
      name: filename,
      size: originalData.length,
      shards: shardCids,
      encrypted,
      encryptionKey: encrypted ? encryptionKey : undefined,
      contentType,
      mimeType,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(originalData)
    };
  }

  static validateManifest(manifest: ShardManifest): boolean {
    return !!(
      manifest.name &&
      manifest.size > 0 &&
      manifest.shards &&
      manifest.shards.length > 0 &&
      manifest.contentType &&
      manifest.mimeType &&
      manifest.timestamp &&
      manifest.checksum
    );
  }

  static async verifyReconstructedFile(data: Uint8Array, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }

  private static calculateChecksum(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  static getOptimalShardSize(fileSize: number, maxShards: number): number {
    const minShardSize = 64 * 1024;
    const maxShardSize = 4 * 1024 * 1024;
    
    const calculatedSize = Math.ceil(fileSize / maxShards);
    
    if (calculatedSize < minShardSize) {
      return minShardSize;
    }
    
    if (calculatedSize > maxShardSize) {
      return maxShardSize;
    }
    
    return calculatedSize;
  }

  static estimateShardCount(fileSize: number, chunkSize: number, maxShards: number): number {
    const theoreticalShards = Math.ceil(fileSize / chunkSize);
    return Math.min(theoreticalShards, maxShards);
  }

  static shouldShard(fileSize: number, config: ShardingConfig): boolean {
    return config.enabled && 
           fileSize > config.chunkSize && 
           fileSize > 1024 * 1024;
  }
}