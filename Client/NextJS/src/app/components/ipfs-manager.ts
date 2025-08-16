import { CID } from 'multiformats/cid';
import { CIDOptions, CIDOptionsManager } from './cid-options';

export interface IPFSAddResult {
  cid: string;
  size: number;
  version: 0 | 1;
  hasher: string;
}

export interface IPFSAddOptions {
  version?: 0 | 1;
  hasher?: { code: number; name: string };
  pin?: boolean;
  wrapWithDirectory?: boolean;
  rawLeaves?: boolean;
  chunker?: any;
  layout?: any;
}

export class IPFSManager {
  private static node: any;
  private static libraries: any;
  private static currentCIDOptions: CIDOptions = {};

  static async loadLibraries(): Promise<boolean> {
    try {
      const [
        { createHelia },
        { unixfs },
        { MemoryBlockstore },
        { MemoryDatastore },
        { CID },
        { concat }
      ] = await Promise.all([
        import('helia'),
        import('@helia/unixfs'),
        import('blockstore-core/memory'),
        import('datastore-core/memory'),
        import('multiformats/cid'),
        import('uint8arrays/concat')
      ]);

      this.libraries = {
        createHelia,
        unixfs,
        MemoryBlockstore,
        MemoryDatastore,
        CID,
        concat
      };

      return true;
    } catch (error) {
      console.error('Failed to load IPFS libraries:', error);
      return false;
    }
  }

  static async createNode(config: any = {}, cidOptions: CIDOptions = {}): Promise<any> {
    if (!this.libraries) {
      throw new Error('Libraries not loaded. Call loadLibraries() first.');
    }

    this.currentCIDOptions = CIDOptionsManager.createCIDOptions(cidOptions);

    try {
      const blockstore = new this.libraries.MemoryBlockstore();
      const datastore = new this.libraries.MemoryDatastore();

      const nodeConfig = {
        blockstore,
        datastore,
        ...config
      };

      const helia = await this.libraries.createHelia(nodeConfig);
      const fs = this.libraries.unixfs(helia);

      this.node = {
        helia,
        fs,
        libp2p: helia.libp2p,
        blockstore,
        datastore
      };

      return this.node;
    } catch (error) {
      console.error('Failed to create IPFS node:', error);
      throw error;
    }
  }

  static getNode(): any {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }
    return this.node;
  }

  static getPeerId(): string {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }
    return this.node.libp2p.peerId.toString();
  }

  static setupEventListeners(
    onPeerConnect: (peerCount: number) => void,
    onPeerDisconnect: (peerCount: number) => void
  ): void {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }

    const libp2p = this.node.libp2p;

    libp2p.addEventListener('peer:connect', () => {
      const peerCount = libp2p.getPeers().length;
      onPeerConnect(peerCount);
    });

    libp2p.addEventListener('peer:disconnect', () => {
      const peerCount = libp2p.getPeers().length;
      onPeerDisconnect(peerCount);
    });
  }

  static async addFile(
    name: string, 
    data: Uint8Array, 
    cidOptions?: CIDOptions
  ): Promise<IPFSAddResult> {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }

    try {
      const options = this.buildAddOptions(cidOptions);
      const fs = this.node.fs;
      
      const cid = await fs.addBytes(data, options);
      
      return {
        cid: cid.toString(),
        size: data.length,
        version: cid.version as 0 | 1,
        hasher: this.getHasherName(cid.multihash.code)
      };
    } catch (error) {
      throw new Error(`Failed to add file to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async addBytes(
    data: Uint8Array, 
    cidOptions?: CIDOptions
  ): Promise<IPFSAddResult> {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }

    try {
      const options = this.buildAddOptions(cidOptions);
      const fs = this.node.fs;
      
      const cid = await fs.addBytes(data, options);
      
      return {
        cid: cid.toString(),
        size: data.length,
        version: cid.version as 0 | 1,
        hasher: this.getHasherName(cid.multihash.code)
      };
    } catch (error) {
      throw new Error(`Failed to add bytes to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getFile(cid: string): Promise<AsyncIterable<Uint8Array>> {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }

    try {
      const cidObj = this.libraries.CID.parse(cid);
      const fs = this.node.fs;
      return fs.cat(cidObj);
    } catch (error) {
      throw new Error(`Failed to get file from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async pin(cid: string): Promise<void> {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }

    try {
      const cidObj = this.libraries.CID.parse(cid);
      await this.node.helia.pins.add(cidObj);
    } catch (error) {
      throw new Error(`Failed to pin CID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async unpin(cid: string): Promise<void> {
    if (!this.node) {
      throw new Error('IPFS node not created. Call createNode() first.');
    }

    try {
      const cidObj = this.libraries.CID.parse(cid);
      await this.node.helia.pins.rm(cidObj);
    } catch (error) {
      throw new Error(`Failed to unpin CID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async stop(): Promise<void> {
    if (this.node) {
      try {
        await this.node.helia.stop();
        this.node = null;
      } catch (error) {
        throw new Error(`Failed to stop IPFS node: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  static isNodeCreated(): boolean {
    return this.node !== null && this.node !== undefined;
  }

  static getConnectedPeers(): string[] {
    if (!this.node) {
      return [];
    }
    return this.node.libp2p.getPeers().map((peer: any) => peer.toString());
  }

  static async initialize(client: any): Promise<void> {
    this.node = client;
  }

  private static buildAddOptions(cidOptions?: CIDOptions): IPFSAddOptions {
    const defaultOptions: IPFSAddOptions = {
      version: 0,
      pin: true,
      wrapWithDirectory: false,
      rawLeaves: false
    };

    if (!cidOptions) {
      return defaultOptions;
    }

    const validatedOptions = CIDOptionsManager.createCIDOptions(cidOptions);
    
    return {
      ...defaultOptions,
      version: validatedOptions.version,
      hasher: validatedOptions.hasher,
      rawLeaves: validatedOptions.rawLeaves,
      chunker: validatedOptions.chunker,
      layout: validatedOptions.layout
    };
  }

  private static getHasherName(code: number): string {
    const hasherMap: { [key: number]: string } = {
      0x12: 'sha2-256',
      0x13: 'sha2-512',
      0xb220: 'blake2b-256',
      0xb260: 'blake2s-256'
    };
    
    return hasherMap[code] || 'unknown';
  }

  static async convertCID(cid: string, targetVersion: 0 | 1): Promise<string> {
    try {
      const cidObj = this.libraries.CID.parse(cid);
      const converted = CIDOptionsManager.convertCIDVersion(cidObj, targetVersion);
      return converted.toString();
    } catch (error) {
      throw new Error(`Failed to convert CID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async validateCID(cid: string): Promise<boolean> {
    try {
      this.libraries.CID.parse(cid);
      return true;
    } catch {
      return false;
    }
  }

  static getCIDInfo(cid: string): { version: number; codec: string; hasher: string } | null {
    try {
      const cidObj = this.libraries.CID.parse(cid);
      return {
        version: cidObj.version,
        codec: this.getCodecName(cidObj.code),
        hasher: this.getHasherName(cidObj.multihash.code)
      };
    } catch {
      return null;
    }
  }

  private static getCodecName(code: number): string {
    const codecMap: { [key: number]: string } = {
      0x55: 'raw',
      0x70: 'dag-pb',
      0x71: 'dag-cbor',
      0x72: 'dag-json'
    };
    
    return codecMap[code] || 'unknown';
  }
}