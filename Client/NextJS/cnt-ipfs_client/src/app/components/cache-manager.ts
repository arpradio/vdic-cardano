export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  compressed: boolean;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  enableCompression: boolean;
  compressionThreshold: number;
  cleanupInterval: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressionRatio: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0
  };
  private cleanupTimer?: NodeJS.Timeout;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024,
      defaultTTL: 60 * 60 * 1000,
      enableCompression: true,
      compressionThreshold: 1024,
      cleanupInterval: 5 * 60 * 1000,
      evictionPolicy: 'lru',
      ...config
    };

    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const now = Date.now();
    const entryTTL = ttl || this.config.defaultTTL;
    
    let serializedValue = JSON.stringify(value);
    let size = new Blob([serializedValue]).size;
    let compressed = false;

    if (this.config.enableCompression && size > this.config.compressionThreshold) {
      try {
        const compressed_data = await this.compress(serializedValue);
        if (compressed_data.length < serializedValue.length) {
          serializedValue = compressed_data;
          size = compressed_data.length;
          compressed = true;
        }
      } catch (error) {
        console.warn('Compression failed, storing uncompressed', error);
      }
    }

    const entry: CacheEntry<string> = {
      key,
      value: serializedValue,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 0,
      lastAccessed: now,
      size,
      compressed
    };

    await this.ensureSpace(size);
    this.cache.set(key, entry);
  }

  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;
    
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (this.isExpired(entry, now)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;

    let value = entry.value;
    if (entry.compressed) {
      try {
        value = await this.decompress(value);
      } catch (error) {
        console.error('Decompression failed', error);
        this.cache.delete(key);
        return null;
      }
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Failed to parse cached value', error);
      this.cache.delete(key);
      return null;
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
  }

  private isExpired(entry: CacheEntry, now: number = Date.now()): boolean {
    return now > entry.timestamp + entry.ttl;
  }

  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.getCurrentSize();
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    const targetSize = this.config.maxSize - requiredSize;
    await this.evictEntries(currentSize - targetSize);
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private async evictEntries(bytesToEvict: number): Promise<void> {
    if (bytesToEvict <= 0) return;

    const entries = Array.from(this.cache.entries());
    let sortedEntries: [string, CacheEntry][];

    switch (this.config.evictionPolicy) {
      case 'lru':
        sortedEntries = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        break;
      case 'lfu':
        sortedEntries = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;
      case 'ttl':
        sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
      default:
        sortedEntries = entries;
    }

    let evictedBytes = 0;
    for (const [key, entry] of sortedEntries) {
      if (evictedBytes >= bytesToEvict) break;
      
      this.cache.delete(key);
      evictedBytes += entry.size;
      this.stats.evictions++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  private async compress(data: string): Promise<string> {
    if (typeof CompressionStream === 'undefined') {
      return data;
    }

    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      const encoder = new TextEncoder();
      const inputBytes = encoder.encode(data);
      
      writer.write(inputBytes);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      return btoa(String.fromCharCode(...compressed));
    } catch (error) {
      throw new Error(`Compression failed: ${error}`);
    }
  }

  private async decompress(compressedData: string): Promise<string> {
    if (typeof DecompressionStream === 'undefined') {
      return compressedData;
    }

    try {
      const binaryString = atob(compressedData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(bytes);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      const decoder = new TextDecoder();
      return decoder.decode(decompressed);
    } catch (error) {
      throw new Error(`Decompression failed: ${error}`);
    }
  }

  getStats(): CacheStats {
    const totalSize = this.getCurrentSize();
    const totalEntries = this.cache.size;
    const hitRate = this.stats.totalRequests > 0 ? (this.stats.hits / this.stats.totalRequests) * 100 : 0;
    const missRate = this.stats.totalRequests > 0 ? (this.stats.misses / this.stats.totalRequests) * 100 : 0;
    
    let compressedSize = 0;
    let uncompressedCount = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.compressed) {
        compressedSize += entry.size;
      } else {
        uncompressedCount++;
      }
    }
    
    const compressionRatio = totalSize > 0 ? ((totalSize - compressedSize) / totalSize) * 100 : 0;

    return {
      totalEntries,
      totalSize,
      hitRate,
      missRate,
      evictions: this.stats.evictions,
      compressionRatio
    };
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  async prefetch<T>(key: string, loader: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttl);
    return value;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    const promises = Array.from(entries.entries()).map(([key, value]) =>
      this.set(key, value, ttl)
    );
    
    await Promise.all(promises);
  }

  touch(key: string, ttl?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (this.isExpired(entry, now)) {
      this.cache.delete(key);
      return false;
    }

    if (ttl !== undefined) {
      entry.ttl = ttl;
      entry.timestamp = now;
    }
    
    entry.lastAccessed = now;
    return true;
  }

  expire(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    entry.timestamp = 0;
    entry.ttl = 0;
    return true;
  }

  persist(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    entry.ttl = Number.MAX_SAFE_INTEGER;
    return true;
  }

  getKeysByPattern(pattern: RegExp): string[] {
    return Array.from(this.cache.keys()).filter(key => pattern.test(key));
  }

  deleteByPattern(pattern: RegExp): number {
    const keysToDelete = this.getKeysByPattern(pattern);
    let deletedCount = 0;
    
    keysToDelete.forEach(key => {
      if (this.cache.delete(key)) {
        deletedCount++;
      }
    });
    
    return deletedCount;
  }

  exportCache(): string {
    const exportData = {
      timestamp: Date.now(),
      config: this.config,
      stats: this.stats,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...entry
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async importCache(data: string): Promise<void> {
    try {
      const importData = JSON.parse(data);
      
      if (importData.entries && Array.isArray(importData.entries)) {
        this.clear();
        
        for (const entryData of importData.entries) {
          const { key, ...entry } = entryData;
          this.cache.set(key, entry);
        }
      }
      
      if (importData.stats) {
        this.stats = { ...this.stats, ...importData.stats };
      }
    } catch (error) {
      throw new Error(`Failed to import cache: ${error}`);
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.clear();
  }

  createNamespacedCache(namespace: string): {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
    has: (key: string) => boolean;
    delete: (key: string) => boolean;
    clear: () => void;
  } {
    const prefixKey = (key: string) => `${namespace}:${key}`;
    
    return {
      get: <T>(key: string) => this.get<T>(prefixKey(key)),
      set: <T>(key: string, value: T, ttl?: number) => this.set(prefixKey(key), value, ttl),
      has: (key: string) => this.has(prefixKey(key)),
      delete: (key: string) => this.delete(prefixKey(key)),
      clear: () => this.deleteByPattern(new RegExp(`^${namespace}:`))
    };
  }
}