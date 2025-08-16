import { IPFSManager } from './ipfs-manager';
import { CIDOptions } from './cid-options';
import { ContentTypeHandler } from './content-handler';
import { CryptoUtils } from './crypto-utils';
import { ShardingUtils } from './sharding-utils';
import { ValidationUtils } from './validation-utils';

export interface UploadResult {
  success: boolean;
  item?: DatastoreItem;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  data?: Uint8Array;
  mimeType?: string;
  error?: string;
}

export interface DatastoreItem {
  cid: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  downloadCount: number;
  encryptionKey?: string;
  shardCount?: number;
  cidVersion?: 0 | 1;
  hashAlgorithm?: string;
}



export class FileOperations {
  static async uploadFile(
    file: File,
    encryptionConfig: any,
    shardingConfig: any,
    onProgress?: (message: string) => void,
    cidOptions?: CIDOptions
  ): Promise<UploadResult> {
    try {
      onProgress?.('Starting file upload...');
      
      if (!ValidationUtils.validateFile(file)) {
        return { success: false, error: 'File validation failed' };
      }

      let fileData = new Uint8Array(await file.arrayBuffer());
      let encryptionKey: string | undefined;

      if (encryptionConfig?.enabled) {
        onProgress?.('Encrypting file...');
        const encrypted = await CryptoUtils.encrypt(fileData, encryptionConfig);
        fileData = encrypted.data;
        encryptionKey = encrypted.key;
      }

      let shardCount: number | undefined;
      if (shardingConfig?.enabled && fileData.length > shardingConfig.chunkSize) {
        onProgress?.('Sharding large file...');
        const shards = await ShardingUtils.createShards(fileData, shardingConfig);
        shardCount = shards.length;
        
        const shardCids = await Promise.all(
          shards.map(async (shard, index) => {
            onProgress?.(`Uploading shard ${index + 1}/${shards.length}...`);
            return await IPFSManager.addFile(`${file.name}.shard.${index}`, shard, cidOptions);
          })
        );

        const manifestData = JSON.stringify({
          shards: shardCids.map(result => result.cid),
          originalSize: fileData.length,
          shardSize: shardingConfig.chunkSize
        });

        const manifestBuffer = new TextEncoder().encode(manifestData);
        const result = await IPFSManager.addFile(`${file.name}.manifest`, manifestBuffer, cidOptions);

        const item: DatastoreItem = {
          cid: result.cid,
          name: file.name,
          size: file.size,
          type: ContentTypeHandler.getContentType(file.name),
          uploadedAt: new Date().toISOString(),
          downloadCount: 0,
          encryptionKey,
          shardCount,
          cidVersion: result.version,
          hashAlgorithm: result.hasher
        };

        onProgress?.('Upload completed successfully!');
        return { success: true, item };
      }

      onProgress?.('Uploading to IPFS...');
      const result = await IPFSManager.addFile(file.name, fileData, cidOptions);

      const item: DatastoreItem = {
        cid: result.cid,
        name: file.name,
        size: file.size,
        type: ContentTypeHandler.getContentType(file.name),
        uploadedAt: new Date().toISOString(),
        downloadCount: 0,
        encryptionKey,
        shardCount,
        cidVersion: result.version,
        hashAlgorithm: result.hasher
      };

      onProgress?.('Upload completed successfully!');
      return { success: true, item };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload';
      return { success: false, error: errorMessage };
    }
  }

  static async downloadFile(
    item: DatastoreItem,
    encryptionConfig: any,
    onProgress?: (message: string) => void
  ): Promise<DownloadResult> {
    try {
      onProgress?.('Starting download...');

      let fileData: Uint8Array;

      if (item.shardCount && item.shardCount > 1) {
        onProgress?.('Downloading sharded file...');
        
        const manifestData = await IPFSManager.getFile(item.cid);
        const manifest = JSON.parse(new TextDecoder().decode(manifestData));

        const shardPromises = manifest.shards.map(async (shardCid: string, index: number) => {
          onProgress?.(`Downloading shard ${index + 1}/${manifest.shards.length}...`);
          return await IPFSManager.getFile(shardCid);
        });

        const shards = await Promise.all(shardPromises);
        fileData = await ShardingUtils.reconstructFromShards(shards);
      } else {
        onProgress?.('Downloading file...');
        fileData = await IPFSManager.getFile(item.cid);
      }

      if (item.encryptionKey && encryptionConfig?.enabled) {
        onProgress?.('Decrypting file...');
        fileData = await CryptoUtils.decrypt(fileData, item.encryptionKey, encryptionConfig);
      }

      const mimeType = ContentTypeHandler.getMimeType(item.name) || item.type;

      onProgress?.('Download completed successfully!');
      return { success: true, data: fileData, mimeType };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during download';
      return { success: false, error: errorMessage };
    }
  }

  static async verifyFile(item: DatastoreItem): Promise<boolean> {
    try {
      return await IPFSManager.verifyFile(item.cid);
    } catch {
      return false;
    }
  }

  static createDownloadLink(data: Uint8Array, filename: string, mimeType?: string): void {
    const blob = new Blob([data], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static getCIDInfo(cid: string): { version: number; codec: number; hasher: string } {
    return IPFSManager.getCIDInfo(cid);
  }

  static convertCIDVersion(cid: string, targetVersion: 0 | 1): string {
    return IPFSManager.convertCIDVersion(cid, targetVersion);
  }
}