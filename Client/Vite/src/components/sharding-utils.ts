import { ShardingOptions } from './types';
import { CryptoUtils } from './crypto-utils';

export interface ShardInfo {
  index: number;
  size: number;
  checksum: string;
  cid?: string;
}

export interface ShardManifest {
  version: string;
  originalSize: number;
  originalChecksum: string;
  shardSize: number;
  shardCount: number;
  redundancy: number;
  algorithm: string;
  shards: ShardInfo[];
  createdAt: number;
}

export class ShardingUtils {
  private static readonly MANIFEST_VERSION = '1.0.0';

  static async createShards(
    data: Uint8Array,
    options: ShardingOptions
  ): Promise<{
    shards: Uint8Array[];
    manifest: ShardManifest;
  }> {
    if (!options.enabled || data.length <= options.chunkSize) {
      throw new Error('Sharding not needed for this file size');
    }

    const shardCount = Math.ceil(data.length / options.chunkSize);
    
    if (shardCount > options.maxShards) {
      throw new Error(`File would create ${shardCount} shards, maximum is ${options.maxShards}`);
    }

    const shards: Uint8Array[] = [];
    const shardInfos: ShardInfo[] = [];
    const originalChecksum = await CryptoUtils.hashData(data);

    for (let i = 0; i < shardCount; i++) {
      const start = i * options.chunkSize;
      const end = Math.min(start + options.chunkSize, data.length);
      const shard = data.slice(start, end);
      
      const checksum = await CryptoUtils.hashData(shard);
      
      shards.push(shard);
      shardInfos.push({
        index: i,
        size: shard.length,
        checksum: checksum
      });
    }

    if (options.redundancy > 1) {
      const redundantShards = await this.createRedundantShards(shards, options.redundancy);
      shards.push(...redundantShards.shards);
      shardInfos.push(...redundantShards.shardInfos);
    }

    const manifest: ShardManifest = {
      version: this.MANIFEST_VERSION,
      originalSize: data.length,
      originalChecksum: originalChecksum,
      shardSize: options.chunkSize,
      shardCount: shardCount,
      redundancy: options.redundancy,
      algorithm: 'simple-chunking',
      shards: shardInfos,
      createdAt: Date.now()
    };

    return { shards, manifest };
  }

  static async reconstructFromShards(
    shards: Uint8Array[],
    manifest: ShardManifest
  ): Promise<Uint8Array> {
    if (shards.length < manifest.shardCount) {
      throw new Error(`Insufficient shards: need ${manifest.shardCount}, got ${shards.length}`);
    }

    const primaryShards = shards.slice(0, manifest.shardCount);
    const verifiedShards: Uint8Array[] = [];

    for (let i = 0; i < manifest.shardCount; i++) {
      const shard = primaryShards[i];
      const expectedInfo = manifest.shards[i];
      
      if (!shard) {
        throw new Error(`Missing shard at index ${i}`);
      }

      const checksum = await CryptoUtils.hashData(shard);
      
      if (checksum !== expectedInfo.checksum) {
        if (manifest.redundancy > 1) {
          const redundantShard = await this.findValidRedundantShard(
            shards,
            i,
            expectedInfo,
            manifest
          );
          
          if (redundantShard) {
            verifiedShards.push(redundantShard);
            continue;
          }
        }
        
        throw new Error(`Shard ${i} checksum mismatch`);
      }

      verifiedShards.push(shard);
    }

    const reconstructed = this.concatenateShards(verifiedShards);
    
    const reconstructedChecksum = await CryptoUtils.hashData(reconstructed);
    if (reconstructedChecksum !== manifest.originalChecksum) {
      throw new Error('Reconstructed file checksum mismatch');
    }

    return reconstructed;
  }

  static async verifyShards(
    shards: Uint8Array[],
    manifest: ShardManifest
  ): Promise<{
    valid: boolean;
    corruptedShards: number[];
    missingShards: number[];
  }> {
    const corruptedShards: number[] = [];
    const missingShards: number[] = [];

    for (let i = 0; i < manifest.shardCount; i++) {
      const shard = shards[i];
      const expectedInfo = manifest.shards[i];

      if (!shard) {
        missingShards.push(i);
        continue;
      }

      const checksum = await CryptoUtils.hashData(shard);
      if (checksum !== expectedInfo.checksum) {
        corruptedShards.push(i);
      }
    }

    return {
      valid: corruptedShards.length === 0 && missingShards.length === 0,
      corruptedShards,
      missingShards
    };
  }

  static calculateOptimalShardSize(fileSize: number, maxShards: number): number {
    const minShardSize = 256 * 1024;
    const maxShardSize = 32 * 1024 * 1024;
    
    let shardSize = Math.ceil(fileSize / maxShards);
    
    shardSize = Math.max(shardSize, minShardSize);
    shardSize = Math.min(shardSize, maxShardSize);
    
    const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(shardSize)));
    return powerOfTwo;
  }

  static estimateShardCount(fileSize: number, shardSize: number): number {
    return Math.ceil(fileSize / shardSize);
  }

  static createManifestBuffer(manifest: ShardManifest): Uint8Array {
    const manifestJson = JSON.stringify(manifest, null, 2);
    return new TextEncoder().encode(manifestJson);
  }

  static parseManifestBuffer(buffer: Uint8Array): ShardManifest {
    const manifestJson = new TextDecoder().decode(buffer);
    return JSON.parse(manifestJson);
  }

  private static async createRedundantShards(
    originalShards: Uint8Array[],
    redundancy: number
  ): Promise<{
    shards: Uint8Array[];
    shardInfos: ShardInfo[];
  }> {
    const redundantShards: Uint8Array[] = [];
    const shardInfos: ShardInfo[] = [];

    for (let r = 1; r < redundancy; r++) {
      for (let i = 0; i < originalShards.length; i++) {
        const shard = originalShards[i];
        const checksum = await CryptoUtils.hashData(shard);
        
        redundantShards.push(shard);
        shardInfos.push({
          index: originalShards.length * r + i,
          size: shard.length,
          checksum: checksum
        });
      }
    }

    return { shards: redundantShards, shardInfos };
  }

  private static async findValidRedundantShard(
    allShards: Uint8Array[],
    shardIndex: number,
    expectedInfo: ShardInfo,
    manifest: ShardManifest
  ): Promise<Uint8Array | null> {
    for (let r = 1; r < manifest.redundancy; r++) {
      const redundantIndex = manifest.shardCount * r + shardIndex;
      const redundantShard = allShards[redundantIndex];
      
      if (redundantShard) {
        const checksum = await CryptoUtils.hashData(redundantShard);
        if (checksum === expectedInfo.checksum) {
          return redundantShard;
        }
      }
    }
    
    return null;
  }

  private static concatenateShards(shards: Uint8Array[]): Uint8Array {
    const totalLength = shards.reduce((sum, shard) => sum + shard.length, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const shard of shards) {
      result.set(shard, offset);
      offset += shard.length;
    }
    
    return result;
  }
}