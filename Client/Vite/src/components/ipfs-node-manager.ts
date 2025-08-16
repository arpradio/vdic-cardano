import { CIDOptions, NodeStats, PeerConfig } from './types';

interface HeliaNode {
  libp2p: any;
  blockstore: any;
  datastore: any;
  stop(): Promise<void>;
}

interface UnixFS {
  addFile(content: AsyncIterable<Uint8Array>, options?: any): Promise<any>;
  cat(cid: string | any): AsyncIterable<Uint8Array>;
  stat(cid: string | any): Promise<{ size: number }>;
}

export class IPFSNodeManager {
  private static instance: IPFSNodeManager;
  private node: HeliaNode | null = null;
  private unixfs: UnixFS | null = null;
  private libraries: any = null;
  private eventListeners: Set<(stats: NodeStats) => void> = new Set();
  private stats: NodeStats = {
    peerId: '',
    connectedPeers: 0,
    totalFiles: 0,
    totalSize: 0,
    uptime: 0,
    status: 'initializing'
  };

  private constructor() {}

  static getInstance(): IPFSNodeManager {
    if (!IPFSNodeManager.instance) {
      IPFSNodeManager.instance = new IPFSNodeManager();
    }
    return IPFSNodeManager.instance;
  }

  async initialize(peers: PeerConfig[]): Promise<void> {
    try {
      this.stats.status = 'initializing';
      await this.loadLibraries();
      await this.createNode(peers);
      this.setupEventListeners();
      this.stats.status = 'ready';
      this.stats.uptime = Date.now();
      this.notifyListeners();
    } catch (error) {
      this.stats.status = 'error';
      this.notifyListeners();
      throw error;
    }
  }

  private async loadLibraries(): Promise<void> {
    try {
      const [
        { createHelia },
        { unixfs },
        { MemoryBlockstore },
        { MemoryDatastore },
        { CID },
        { concat },
        { noise },
        { yamux },
        { bootstrap },
        { identify },
        { ping }
      ] = await Promise.all([
        import('helia'),
        import('@helia/unixfs'),
        import('blockstore-core/memory'),
        import('datastore-core/memory'),
        import('multiformats/cid'),
        import('uint8arrays/concat'),
        import('@chainsafe/libp2p-noise'),
        import('@chainsafe/libp2p-yamux'),
        import('@libp2p/bootstrap'),
        import('@libp2p/identify'),
        import('@libp2p/ping')
      ]);

      this.libraries = {
        createHelia,
        unixfs,
        MemoryBlockstore,
        MemoryDatastore,
        CID,
        concat,
        noise,
        yamux,
        bootstrap,
        identify,
        ping
      };
    } catch (error) {
      throw new Error(`Failed to load IPFS libraries: ${error}`);
    }
  }

  private async createNode(peers: PeerConfig[]): Promise<void> {
    if (!this.libraries) {
      throw new Error('Libraries not loaded');
    }

    const enabledPeers = peers.filter(p => p.enabled);
    const bootstrapAddresses = enabledPeers.map(p => p.multiaddr);

    const blockstore = new this.libraries.MemoryBlockstore();
    const datastore = new this.libraries.MemoryDatastore();

    const libp2pConfig = {
      addresses: {
        listen: []
      },
      transports: [],
      connectionEncryption: [this.libraries.noise()],
      streamMuxers: [this.libraries.yamux()],
      peerDiscovery: bootstrapAddresses.length > 0 ? [
        this.libraries.bootstrap({
          list: bootstrapAddresses
        })
      ] : [],
      services: {
        identify: this.libraries.identify(),
        ping: this.libraries.ping()
      }
    };

    this.node = await this.libraries.createHelia({
      blockstore,
      datastore,
      libp2p: libp2pConfig
    });

    this.unixfs = this.libraries.unixfs(this.node);
    this.stats.peerId = this.node.libp2p.peerId.toString();
  }

  private setupEventListeners(): void {
    if (!this.node?.libp2p) return;

    this.node.libp2p.addEventListener('peer:connect', () => {
      this.updatePeerCount();
    });

    this.node.libp2p.addEventListener('peer:disconnect', () => {
      this.updatePeerCount();
    });
  }

  private updatePeerCount(): void {
    if (this.node?.libp2p) {
      this.stats.connectedPeers = this.node.libp2p.getPeers().length;
      this.notifyListeners();
    }
  }

  async addFile(
    content: Uint8Array,
    filename: string,
    cidOptions: CIDOptions
  ): Promise<{ cid: string; size: number }> {
    if (!this.unixfs) {
      throw new Error('IPFS node not initialized');
    }

    try {
      console.log('Adding file to IPFS:', filename, 'size:', content.length);
      console.log('Content type:', Object.prototype.toString.call(content));
      console.log('Requested CID options:', cidOptions);
      
      const options = this.buildAddOptions(cidOptions);
      console.log('Final IPFS add options:', options);
      
      let cid;
      let method = 'unknown';
      
      // Method 1: Try addBytes with Uint8Array (most direct for raw bytes)
      try {
        console.log('Method 1: Trying addBytes with Uint8Array...');
        cid = await this.unixfs.addBytes(content, options);
        method = 'addBytes';
      } catch (bytesError) {
        console.warn('addBytes failed:', bytesError?.message || bytesError);
        
        // Method 2: Try addFile with AsyncIterable (as per documentation)
        try {
          console.log('Method 2: Trying addFile with AsyncIterable...');
          const asyncIterable = this.createAsyncIterable(content);
          cid = await this.unixfs.addFile({
            path: filename,
            content: asyncIterable
          }, options);
          method = 'addFile-async';
        } catch (fileAsyncError) {
          console.warn('addFile with AsyncIterable failed:', fileAsyncError?.message || fileAsyncError);
          
          // Method 3: Try addFile with Uint8Array directly
          try {
            console.log('Method 3: Trying addFile with Uint8Array directly...');
            cid = await this.unixfs.addFile({
              path: filename,
              content: content
            }, options);
            method = 'addFile-direct';
          } catch (fileDirectError) {
            console.warn('addFile with Uint8Array failed:', fileDirectError?.message || fileDirectError);
            
            // Method 4: Fallback with no options
            console.log('Method 4: Trying fallback with minimal options...');
            try {
              cid = await this.unixfs.addBytes(content, { cidVersion: cidOptions.version });
              method = 'addBytes-fallback';
            } catch (fallbackError) {
              console.error('All methods failed. Last error:', fallbackError);
              throw new Error(`Failed to add file with all methods. Last error: ${fallbackError?.message || fallbackError}`);
            }
          }
        }
      }
      
      console.log(`File added successfully using ${method}, CID:`, cid.toString());
      console.log('Generated CID version:', cid.version);
      console.log('Generated CID codec:', cid.code);
      console.log('Generated CID multihash code:', cid.multihash.code);
      
      // Verify the CID version matches what was requested
      if (cid.version !== cidOptions.version) {
        console.warn(`⚠️  CID version mismatch! Requested: ${cidOptions.version}, Got: ${cid.version}`);
        console.warn('This may be due to Helia defaults overriding the request');
      } else {
        console.log(`✅ CID version ${cid.version} applied correctly`);
      }
      
      return {
        cid: cid.toString(),
        size: content.length
      };
    } catch (error) {
      console.error('Error adding file to IPFS:', error);
      throw error;
    }
  }

  async getFile(cid: string): Promise<Uint8Array> {
    if (!this.unixfs || !this.libraries) {
      throw new Error('IPFS node not initialized');
    }

    try {
      console.log('Retrieving file from IPFS:', cid);
      
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.unixfs.cat(cid)) {
        chunks.push(chunk);
      }

      const result = this.libraries.concat(chunks);
      console.log('File retrieved successfully, size:', result.length);
      
      return result;
    } catch (error) {
      console.error('Error retrieving file from IPFS:', error);
      throw error;
    }
  }

  async getFileInfo(cid: string): Promise<{ size: number }> {
    if (!this.unixfs) {
      throw new Error('IPFS node not initialized');
    }

    try {
      const stat = await this.unixfs.stat(cid);
      return { size: Number(stat.fileSize) };
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  async verifyFile(cid: string): Promise<boolean> {
    try {
      await this.getFileInfo(cid);
      return true;
    } catch {
      return false;
    }
  }

  async connectToPeer(multiaddr: string): Promise<void> {
    if (!this.node?.libp2p) {
      throw new Error('IPFS node not initialized');
    }

    await this.node.libp2p.dial(multiaddr);
    this.updatePeerCount();
  }

  async disconnectFromPeer(peerId: string): Promise<void> {
    if (!this.node?.libp2p) {
      throw new Error('IPFS node not initialized');
    }

    await this.node.libp2p.hangUp(peerId);
    this.updatePeerCount();
  }

  getConnectedPeers(): string[] {
    if (!this.node?.libp2p) {
      return [];
    }

    return this.node.libp2p.getPeers().map((peer: any) => peer.toString());
  }

  onStatsUpdate(listener: (stats: NodeStats) => void): void {
    this.eventListeners.add(listener);
  }

  offStatsUpdate(listener: (stats: NodeStats) => void): void {
    this.eventListeners.delete(listener);
  }

  getStats(): NodeStats {
    return { ...this.stats };
  }

  async stop(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
      this.unixfs = null;
      this.stats.status = 'stopped';
      this.notifyListeners();
    }
  }

  private createAsyncIterable(data: Uint8Array): AsyncIterable<Uint8Array> {
    return {
      async *[Symbol.asyncIterator]() {
        yield data;
      }
    };
  }

  private buildAddOptions(cidOptions: CIDOptions): any {
    console.log('Building add options for:', cidOptions);
    
    const options: any = {
      cidVersion: cidOptions.version
    };

    if (cidOptions.version === 0) {
      // CID v0 requirements:
      // - Must use sha2-256 hash (cannot specify custom hasher)
      // - Must use dag-pb codec
      // - Cannot use rawLeaves
      console.log('Using CID v0 with required defaults (dag-pb + sha2-256)');
      // Don't set rawLeaves or hasher for v0
    } else {
      // CID v1 can use rawLeaves and custom hashers
      options.rawLeaves = true;
      console.log('Using CID v1 with rawLeaves enabled');
    }

    console.log('Built options:', options);
    return options;
  }

  private notifyListeners(): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(this.stats);
      } catch (error) {
        console.error('Error in stats listener:', error);
      }
    });
  }

  updateFileStats(totalFiles: number, totalSize: number): void {
    this.stats.totalFiles = totalFiles;
    this.stats.totalSize = totalSize;
    this.notifyListeners();
  }
}