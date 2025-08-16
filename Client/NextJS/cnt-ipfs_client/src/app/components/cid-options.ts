import { CID } from 'multiformats/cid';
import { sha256, sha512 } from 'multiformats/hashes/sha2';
import { blake2b256 } from '@multiformats/blake2/blake2b';
import * as dagPB from '@ipld/dag-pb';
import * as raw from 'multiformats/codecs/raw';

export interface CIDOptions {
  version?: 0 | 1;
  hasher?: {
    name: string;
    code?: number;
  };
  rawLeaves?: boolean;
  chunker?: {
    name: string;
    chunkSize?: number;
  };
  layout?: {
    name: string;
    maxChildrenPerNode?: number;
  };
}

export interface HasherConfig {
  name: string;
  code: number;
  hasher: any;
}

export class CIDOptionsManager {
  private static readonly SUPPORTED_HASHERS: Record<string, HasherConfig> = {
    'sha2-256': { name: 'sha2-256', code: 0x12, hasher: sha256 },
    'sha2-512': { name: 'sha2-512', code: 0x13, hasher: sha512 },
    'blake2b-256': { name: 'blake2b-256', code: 0xb220, hasher: blake2b256 }
    
  };

  private static readonly DEFAULT_OPTIONS: Required<CIDOptions> = {
    version: 0,
    hasher: { name: 'sha2-256', code: 0x12 },
    rawLeaves: false,
    chunker: { name: 'fixed', chunkSize: 1_048_576 },
    layout: { name: 'balanced', maxChildrenPerNode: 1024 }
  };

  static createCIDOptions(options: Partial<CIDOptions> = {}): Required<CIDOptions> {
    const merged = {
      ...this.DEFAULT_OPTIONS,
      ...options
    };

    if (options.hasher?.name && !options.hasher.code) {
      const hasherConfig = this.SUPPORTED_HASHERS[options.hasher.name];
      if (hasherConfig) {
        merged.hasher = {
          name: hasherConfig.name,
          code: hasherConfig.code
        };
      }
    }

    this.validateCIDOptions(merged);
    return merged;
  }

  static validateCIDOptions(options: CIDOptions): void {
    if (options.version !== undefined && options.version !== 0 && options.version !== 1) {
      throw new Error('CID version must be 0 or 1');
    }

    if (options.hasher?.name && !this.SUPPORTED_HASHERS[options.hasher.name]) {
      throw new Error(`Unsupported hasher: ${options.hasher.name}`);
    }

    if (options.chunker?.chunkSize !== undefined) {
      if (typeof options.chunker.chunkSize !== 'number' || options.chunker.chunkSize <= 0) {
        throw new Error('Chunk size must be a positive number');
      }
      if (options.chunker.chunkSize > 10 * 1024 * 1024) {
        throw new Error('Chunk size too large (max 10MB)');
      }
    }

    if (options.layout?.maxChildrenPerNode !== undefined) {
      if (typeof options.layout.maxChildrenPerNode !== 'number' || options.layout.maxChildrenPerNode <= 0) {
        throw new Error('Max children per node must be a positive number');
      }
    }
  }

  static getHasherConfig(name: string): HasherConfig {
    const config = this.SUPPORTED_HASHERS[name];
    if (!config) {
      throw new Error(`Unsupported hasher: ${name}`);
    }
    return config;
  }

  static convertCIDVersion(cid: CID, targetVersion: 0 | 1): CID {
    if (cid.version === targetVersion) {
      return cid;
    }

    if (targetVersion === 0) {
      if (cid.code !== dagPB.code) {
        throw new Error('Cannot convert non-dag-pb CID to version 0');
      }
      if (cid.multihash.code !== sha256.code) {
        throw new Error('Cannot convert non-sha256 CID to version 0');
      }
      return CID.createV0(cid.multihash as MultihashDigest<18>);
    } else {
      return CID.createV1(cid.code, cid.multihash);
    }
  }

  static createCIDFromOptions(
    data: Uint8Array,
    options: Required<CIDOptions>
  ): Promise<CID> {
    const hasherConfig = this.getHasherConfig(options.hasher.name);
    
    return new Promise(async (resolve, reject) => {
      try {
        const hash = await hasherConfig.hasher.digest(data);
        
        const codec = options.rawLeaves ? raw.code : dagPB.code;
        
        const cid = options.version === 0
          ? CID.createV0(hash)
          : CID.createV1(codec, hash);
        
        resolve(cid);
      } catch (error) {
        reject(error);
      }
    });
  }

  static getCIDStats(cid: CID): {
    version: number;
    codec: string;
    hasher: string;
    size: number;
  } {
    const codecNames: Record<number, string> = {
      [raw.code]: 'raw',
      [dagPB.code]: 'dag-pb'
    };

    const hasherNames: Record<number, string> = Object.fromEntries(
      Object.values(this.SUPPORTED_HASHERS).map(h => [h.code, h.name])
    );

    return {
      version: cid.version,
      codec: codecNames[cid.code] || 'unknown',
      hasher: hasherNames[cid.multihash.code] || 'unknown',
      size: cid.multihash.size
    };
  }

  static generateCIDOptionsPresets(): Record<string, CIDOptions> {
    return {
      default: {
        version: 1,
        hasher: { name: 'sha2-256' },
        rawLeaves: true
      },
      legacy: {
        version: 0,
        hasher: { name: 'sha2-256' },
        rawLeaves: false
      },
      secure: {
        version: 1,
        hasher: { name: 'blake2b-256' },
        rawLeaves: true
      },
      fastHashing: {
        version: 1,
        hasher: { name: 'blake2s-256' },
        rawLeaves: true,
        chunker: { name: 'fixed', chunkSize: 2_097_152 }
      },
      smallFiles: {
        version: 1,
        hasher: { name: 'sha2-256' },
        rawLeaves: true,
        chunker: { name: 'fixed', chunkSize: 262_144 }
      },
      largeBinary: {
        version: 1,
        hasher: { name: 'sha2-256' },
        rawLeaves: true,
        chunker: { name: 'fixed', chunkSize: 4_194_304 },
        layout: { name: 'balanced', maxChildrenPerNode: 512 }
      }
    };
  }

  static optimizeCIDOptionsForFile(
    file: File,
    baseOptions: Partial<CIDOptions> = {}
  ): CIDOptions {
    const size = file.size;
    const type = file.type;
    
    let optimized: CIDOptions = { ...baseOptions };

    if (size < 1024 * 1024) {
      optimized.chunker = { name: 'fixed', chunkSize: 262_144 };
    } else if (size > 100 * 1024 * 1024) {
      optimized.chunker = { name: 'fixed', chunkSize: 4_194_304 };
      optimized.layout = { name: 'balanced', maxChildrenPerNode: 512 };
    }

    if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
      optimized.hasher = { name: 'blake2s-256' };
    }

    if (type === 'application/octet-stream' || type.startsWith('application/')) {
      optimized.rawLeaves = true;
    }

    return optimized;
  }
}