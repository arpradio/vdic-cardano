import { DatastoreItem } from './interfaces';
import { IPFSManager } from './ipfs-manager';
import { Logger } from './logger';

export interface CARExportOptions {
  includePinned: boolean;
  includeUnverified: boolean;
  maxSize: number;
  compression: boolean;
}

export interface CARImportResult {
  success: boolean;
  importedItems: DatastoreItem[];
  errors: string[];
  warnings: string[];
}

export interface CARMetadata {
  version: string;
  created: number;
  itemCount: number;
  totalSize: number;
  rootCIDs: string[];
  checksum: string;
}

export class CARHandler {
  private static logger = Logger.getInstance().createChildLogger('CAR');

  static async exportToCAR(
    items: DatastoreItem[],
    options: Partial<CARExportOptions> = {}
  ): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
    const opts: CARExportOptions = {
      includePinned: true,
      includeUnverified: false,
      maxSize: 100 * 1024 * 1024,
      compression: false,
      ...options
    };

    try {
      this.logger.info(`Starting CAR export for ${items.length} items`);

      const filteredItems = this.filterItemsForExport(items, opts);
      this.logger.info(`Filtered to ${filteredItems.length} items for export`);

      if (filteredItems.length === 0) {
        return { success: false, error: 'No items to export' };
      }

      const node = IPFSManager.getNode();
      if (!node?.carService) {
        return { success: false, error: 'CAR service not available' };
      }

      const rootCIDs = filteredItems.map(item => item.cid);
      const metadata = this.createCARMetadata(filteredItems);

      this.logger.info('Creating CAR archive...');
      const carData = await this.createCARArchive(node.carService, rootCIDs, metadata);

      if (opts.compression) {
        this.logger.info('Compressing CAR data...');
        const compressed = await this.compressData(carData);
        return { success: true, data: compressed };
      }

      this.logger.info(`CAR export completed: ${carData.length} bytes`);
      return { success: true, data: carData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`CAR export failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  static async importFromCAR(
    carData: Uint8Array,
    targetDatastore: DatastoreItem[]
  ): Promise<CARImportResult> {
    const result: CARImportResult = {
      success: false,
      importedItems: [],
      errors: [],
      warnings: []
    };

    try {
      this.logger.info(`Starting CAR import: ${carData.length} bytes`);

      let processedData = carData;

      if (this.isCompressed(carData)) {
        this.logger.info('Decompressing CAR data...');
        processedData = await this.decompressData(carData);
      }

      const node = IPFSManager.getNode();
      if (!node?.carService) {
        result.errors.push('CAR service not available');
        return result;
      }

      const parsedCAR = await this.parseCARArchive(node.carService, processedData);
      const metadata = this.extractCARMetadata(parsedCAR);

      if (metadata) {
        this.logger.info(`CAR metadata: ${metadata.itemCount} items, ${metadata.totalSize} bytes`);
      }

      const importedCIDs = this.extractCIDsFromCAR(parsedCAR);
      this.logger.info(`Extracted ${importedCIDs.length} CIDs from CAR`);

      for (const cid of importedCIDs) {
        try {
          const item = await this.reconstructDatastoreItem(cid, targetDatastore);
          if (item) {
            if (this.isDuplicateItem(item, targetDatastore)) {
              result.warnings.push(`Duplicate item skipped: ${item.name}`);
            } else {
              result.importedItems.push(item);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.warnings.push(`Failed to reconstruct item for CID ${cid}: ${errorMessage}`);
        }
      }

      result.success = result.importedItems.length > 0;
      this.logger.info(`CAR import completed: ${result.importedItems.length} items imported`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      this.logger.error(`CAR import failed: ${errorMessage}`);
    }

    return result;
  }

  private static filterItemsForExport(items: DatastoreItem[], options: CARExportOptions): DatastoreItem[] {
    return items.filter(item => {
      if (!options.includeUnverified && !item.verified) {
        return false;
      }
      return true;
    });
  }

  private static createCARMetadata(items: DatastoreItem[]): CARMetadata {
    const totalSize = items.reduce((sum, item) => sum + item.size, 0);
    const rootCIDs = items.map(item => item.cid);

    return {
      version: '1.0.0',
      created: Date.now(),
      itemCount: items.length,
      totalSize,
      rootCIDs,
      checksum: this.calculateChecksum(rootCIDs.join(''))
    };
  }

  private static async createCARArchive(
    carService: any,
    rootCIDs: string[],
    metadata: CARMetadata
  ): Promise<Uint8Array> {
    const metadataBlock = new TextEncoder().encode(JSON.stringify(metadata));
    
    const carBlocks = [];
    carBlocks.push(metadataBlock);

    for (const cidString of rootCIDs) {
      try {
        const cid = IPFSManager.parseCID(cidString);
        const blockData = await carService.export(cid);
        carBlocks.push(blockData);
      } catch (error) {
        this.logger.warn(`Failed to export block for CID: ${cidString}`);
      }
    }

    return this.combineBlocks(carBlocks);
  }

  private static async parseCARArchive(carService: any, carData: Uint8Array): Promise<any> {
    try {
      return await carService.import(carData);
    } catch (error) {
      this.logger.error('Failed to parse CAR archive');
      throw error;
    }
  }

  private static extractCARMetadata(parsedCAR: any): CARMetadata | null {
    try {
      if (parsedCAR && parsedCAR.metadata) {
        return JSON.parse(new TextDecoder().decode(parsedCAR.metadata));
      }
      return null;
    } catch (error) {
      this.logger.warn('Failed to extract CAR metadata');
      return null;
    }
  }

  private static extractCIDsFromCAR(parsedCAR: any): string[] {
    try {
      if (parsedCAR && parsedCAR.roots) {
        return parsedCAR.roots.map((cid: any) => cid.toString());
      }
      return [];
    } catch (error) {
      this.logger.error('Failed to extract CIDs from CAR');
      return [];
    }
  }

  private static async reconstructDatastoreItem(
    cid: string,
    existingDatastore: DatastoreItem[]
  ): Promise<DatastoreItem | null> {
    try {
      const existingItem = existingDatastore.find(item => item.cid === cid);
      if (existingItem) {
        return { ...existingItem };
      }

      const data = await IPFSManager.getFile(cid);
      const size = data.length;

      return {
        cid,
        name: `imported-${cid.slice(0, 8)}`,
        size,
        type: 'application/octet-stream',
        contentType: 'binary',
        mimeType: 'application/octet-stream',
        timestamp: Date.now(),
        encrypted: false,
        sharded: false,
        pinned: [],
        verified: false,
        downloadCount: 0,
        metadata: {
          imported: true,
          importDate: Date.now()
        }
      };
    } catch (error) {
      this.logger.warn(`Failed to reconstruct item for CID: ${cid}`);
      return null;
    }
  }

  private static isDuplicateItem(item: DatastoreItem, datastore: DatastoreItem[]): boolean {
    return datastore.some(existing => existing.cid === item.cid);
  }

  private static combineBlocks(blocks: Uint8Array[]): Uint8Array {
    const totalLength = blocks.reduce((sum, block) => sum + block.length + 4, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const block of blocks) {
      const lengthBytes = new Uint8Array(4);
      new DataView(lengthBytes.buffer).setUint32(0, block.length, false);
      
      result.set(lengthBytes, offset);
      offset += 4;
      result.set(block, offset);
      offset += block.length;
    }
    
    return result;
  }

  private static calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private static async compressData(data: Uint8Array): Promise<Uint8Array> {
    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(data);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    } catch (error) {
      this.logger.warn('Compression not supported, returning uncompressed data');
      return data;
    }
  }

  private static async decompressData(data: Uint8Array): Promise<Uint8Array> {
    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(data);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    } catch (error) {
      this.logger.warn('Decompression failed, returning original data');
      return data;
    }
  }

  private static isCompressed(data: Uint8Array): boolean {
    return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  }

  static async validateCARFile(carData: Uint8Array): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (carData.length === 0) {
        errors.push('CAR file is empty');
        return { valid: false, errors };
      }

      let processedData = carData;
      if (this.isCompressed(carData)) {
        try {
          processedData = await this.decompressData(carData);
        } catch (error) {
          errors.push('Failed to decompress CAR data');
          return { valid: false, errors };
        }
      }

      const node = IPFSManager.getNode();
      if (!node?.carService) {
        errors.push('CAR service not available');
        return { valid: false, errors };
      }

      try {
        const parsedCAR = await this.parseCARArchive(node.carService, processedData);
        
        if (!parsedCAR) {
          errors.push('Failed to parse CAR structure');
        }

        const metadata = this.extractCARMetadata(parsedCAR);
        if (metadata) {
          if (!metadata.version) {
            errors.push('Missing version in metadata');
          }
          if (!metadata.rootCIDs || metadata.rootCIDs.length === 0) {
            errors.push('No root CIDs found in metadata');
          }
        }

        const cids = this.extractCIDsFromCAR(parsedCAR);
        if (cids.length === 0) {
          errors.push('No CIDs found in CAR file');
        }

      } catch (error) {
        errors.push(`CAR parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { valid: errors.length === 0, errors };
  }

  static createDownloadLink(carData: Uint8Array, filename: string = 'export.car'): void {
    const blob = new Blob([carData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}