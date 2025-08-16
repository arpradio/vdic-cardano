import { 
  FileMetadata, 
  UploadOptions, 
  UploadProgress, 
  PinningService 
} from './types';
import { IPFSNodeManager } from './ipfs-node-manager';
import { CryptoUtils } from './crypto-utils';
import { ShardingUtils, ShardManifest } from './sharding-utils';
import { PinningServiceManager, PinningProgress } from './pinning-service-manager';
import { StorageManager } from './storage-manager';

export interface UploadResult {
  success: boolean;
  file?: FileMetadata;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  data?: Uint8Array;
  mimeType?: string;
  error?: string;
}

export class FileOperationsManager {
  private static ipfsManager = IPFSNodeManager.getInstance();

  static async uploadFile(
    file: File,
    options: UploadOptions,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      console.log('Starting upload for file:', file.name, 'with options:', options);
      
      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: 'Preparing file for upload...'
      });

      let fileData = new Uint8Array(await file.arrayBuffer());
      const originalSize = fileData.length;
      let encryptionKey: string | undefined;
      let shardManifest: ShardManifest | undefined;
      let shardCids: string[] = [];

      console.log('File data prepared, size:', originalSize, 'bytes');

      if (options.enabled && options.algorithm) {
        onProgress?.({
          stage: 'encrypting',
          progress: 20,
          message: 'Encrypting file...'
        });

        console.log('Encrypting file with algorithm:', options.algorithm);
        const encryptionResult = await CryptoUtils.encryptWithMetadata(fileData, options);
        fileData = encryptionResult.encryptedData;
        encryptionKey = encryptionResult.metadata.key;
        console.log('Encryption completed');
      }

      const shouldShard = options.chunkSize > 0 && fileData.length > options.chunkSize;
      console.log('Should shard?', shouldShard, 'chunkSize:', options.chunkSize, 'fileSize:', fileData.length);

      if (shouldShard) {
        onProgress?.({
          stage: 'sharding',
          progress: 40,
          message: 'Creating file shards...'
        });

        const shardingResult = await ShardingUtils.createShards(fileData, options);
        const shards = shardingResult.shards;
        shardManifest = shardingResult.manifest;

        onProgress?.({
          stage: 'uploading',
          progress: 50,
          message: `Uploading ${shards.length} shards...`
        });

        const shardUploadPromises = shards.map(async (shard, index) => {
          const shardName = `${file.name}.shard.${index}`;
          const result = await this.ipfsManager.addFile(shard, shardName, {
            version: options.version,
            codec: options.codec,
            hasher: options.hasher
          });
          
          shardManifest!.shards[index].cid = result.cid;
          return result.cid;
        });

        shardCids = await Promise.all(shardUploadPromises);

        const manifestBuffer = ShardingUtils.createManifestBuffer(shardManifest);
        const manifestResult = await this.ipfsManager.addFile(
          manifestBuffer,
          `${file.name}.manifest`,
          {
            version: options.version,
            codec: options.codec,
            hasher: options.hasher
          }
        );

        const fileMetadata: FileMetadata = {
          cid: manifestResult.cid,
          name: file.name,
          size: originalSize,
          mimeType: file.type || 'application/octet-stream',
          contentType: this.determineContentType(file.type),
          uploadedAt: Date.now(),
          lastAccessedAt: Date.now(),
          downloadCount: 0,
          encrypted: !!encryptionKey,
          sharded: true,
          shardCount: shards.length,
          encryptionKey,
          cidVersion: options.version,
          hasher: options.hasher,
          pinned: [],
          verified: true,
          tags: options.tags || [],
          description: options.description
        };

        StorageManager.addFile(fileMetadata);

        if (options.pin && options.pinToServices) {
          await this.pinFileToServices(fileMetadata, options.pinToServices, onProgress);
        }

        onProgress?.({
          stage: 'complete',
          progress: 100,
          message: 'Upload completed successfully!'
        });

        return { success: true, file: fileMetadata };
      } else {
        onProgress?.({
          stage: 'uploading',
          progress: 60,
          message: 'Uploading file to IPFS...'
        });

        try {
          console.log('Calling IPFS addFile with data size:', fileData.length);
          const result = await this.ipfsManager.addFile(fileData, file.name, {
            version: options.version,
            codec: options.codec,
            hasher: options.hasher
          });
          console.log('IPFS addFile completed:', result);

          // Parse the actual CID to get the real version and properties
          const cidObj = await this.parseCID(result.cid);
          console.log('Parsed CID details:', cidObj);
          
          // Show comparison between requested and actual
          console.log('CID Comparison:');
          console.log(`  Requested: v${options.version} with ${options.hasher}`);
          console.log(`  Generated: v${cidObj.version} with ${this.getHasherName(cidObj.multihashCode)}`);
          
          if (cidObj.version !== options.version) {
            console.warn('💡 CID version override explanation:');
            if (options.version === 0) {
              console.warn('   CID v0 has strict requirements:');
              console.warn('   - Must use dag-pb codec');
              console.warn('   - Must use sha2-256 hash');
              console.warn('   - Cannot use raw leaves');
              console.warn('   Helia may upgrade to v1 for compatibility');
            }
          }

          const fileMetadata: FileMetadata = {
            cid: result.cid,
            name: file.name,
            size: originalSize,
            mimeType: file.type || 'application/octet-stream',
            contentType: this.determineContentType(file.type),
            uploadedAt: Date.now(),
            lastAccessedAt: Date.now(),
            downloadCount: 0,
            encrypted: !!encryptionKey,
            sharded: false,
            encryptionKey,
            cidVersion: cidObj.version, // Use actual CID version
            hasher: this.getHasherName(cidObj.multihashCode), // Use actual hasher
            pinned: [],
            verified: true,
            tags: options.tags || [],
            description: options.description
          };

          console.log('Created file metadata:', fileMetadata);
          StorageManager.addFile(fileMetadata);

          if (options.pin && options.pinToServices) {
            await this.pinFileToServices(fileMetadata, options.pinToServices, onProgress);
          }

          onProgress?.({
            stage: 'complete',
            progress: 100,
            message: cidObj.version !== options.version 
              ? `Upload complete! Generated CID v${cidObj.version} (requested v${options.version})`
              : 'Upload completed successfully!'
          });

          return { success: true, file: fileMetadata };
        } catch (ipfsError) {
          console.error('IPFS upload error:', ipfsError);
          throw new Error(`Failed to upload to IPFS: ${ipfsError instanceof Error ? ipfsError.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Upload failed',
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  static async downloadFile(
    fileMetadata: FileMetadata,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<DownloadResult> {
    try {
      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: 'Starting download...'
      });

      let fileData: Uint8Array;

      if (fileMetadata.sharded && fileMetadata.shardCount) {
        onProgress?.({
          stage: 'preparing',
          progress: 20,
          message: 'Downloading sharded file...'
        });

        const manifestData = await this.ipfsManager.getFile(fileMetadata.cid);
        const manifest = ShardingUtils.parseManifestBuffer(manifestData);

        onProgress?.({
          stage: 'uploading',
          progress: 40,
          message: `Downloading ${manifest.shardCount} shards...`
        });

        const shardPromises = manifest.shards.map(async (shardInfo, index) => {
          if (!shardInfo.cid) {
            throw new Error(`Missing CID for shard ${index}`);
          }
          
          onProgress?.({
            stage: 'uploading',
            progress: 40 + (index / manifest.shardCount) * 40,
            message: `Downloading shard ${index + 1}/${manifest.shardCount}...`
          });

          return await this.ipfsManager.getFile(shardInfo.cid);
        });

        const shards = await Promise.all(shardPromises);
        fileData = await ShardingUtils.reconstructFromShards(shards, manifest);
      } else {
        onProgress?.({
          stage: 'uploading',
          progress: 50,
          message: 'Downloading file...'
        });

        fileData = await this.ipfsManager.getFile(fileMetadata.cid);
      }

      if (fileMetadata.encrypted && fileMetadata.encryptionKey) {
        onProgress?.({
          stage: 'encrypting',
          progress: 80,
          message: 'Decrypting file...'
        });

        const keyParts = fileMetadata.encryptionKey.split(':');
        if (keyParts.length >= 2) {
          const key = keyParts[0];
          const iv = CryptoUtils.hexToUint8Array(keyParts[1]);
          const algorithm = keyParts[2] || 'AES-GCM';
          
          fileData = await CryptoUtils.decrypt(fileData, key, iv, algorithm);
        } else {
          throw new Error('Invalid encryption key format');
        }
      }

      StorageManager.updateFile(fileMetadata.cid, {
        lastAccessedAt: Date.now(),
        downloadCount: fileMetadata.downloadCount + 1
      });

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Download completed!'
      });

      return {
        success: true,
        data: fileData,
        mimeType: fileMetadata.mimeType
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
      
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Download failed',
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  static async verifyFile(fileMetadata: FileMetadata): Promise<boolean> {
    try {
      if (fileMetadata.sharded) {
        const manifestData = await this.ipfsManager.getFile(fileMetadata.cid);
        const manifest = ShardingUtils.parseManifestBuffer(manifestData);
        
        const shardPromises = manifest.shards.map(async (shardInfo) => {
          if (!shardInfo.cid) return null;
          return await this.ipfsManager.getFile(shardInfo.cid);
        });

        const shards = await Promise.all(shardPromises);
        const validShards = shards.filter(s => s !== null) as Uint8Array[];
        
        const verification = await ShardingUtils.verifyShards(validShards, manifest);
        return verification.valid;
      } else {
        return await this.ipfsManager.verifyFile(fileMetadata.cid);
      }
    } catch {
      return false;
    }
  }

  static async deleteFile(cid: string): Promise<void> {
    StorageManager.removeFile(cid);
  }

  static createDownloadUrl(data: Uint8Array, filename: string, mimeType: string): string {
    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  static downloadBlob(data: Uint8Array, filename: string, mimeType: string): void {
    const url = this.createDownloadUrl(data, filename, mimeType);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private static async pinFileToServices(
    fileMetadata: FileMetadata,
    serviceIds: string[],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    if (serviceIds.length === 0) return;

    onProgress?.({
      stage: 'pinning',
      progress: 90,
      message: `Pinning to ${serviceIds.length} services...`
    });

    const config = StorageManager.loadConfig();
    const services = config.pinningServices.filter(s => 
      serviceIds.includes(s.id) && s.enabled && s.verified
    );

    const pinningProgress = (progress: PinningProgress) => {
      if (progress.status === 'pinned') {
        const updatedPinned = [...fileMetadata.pinned];
        if (!updatedPinned.includes(progress.serviceId)) {
          updatedPinned.push(progress.serviceId);
        }
        
        StorageManager.updateFile(fileMetadata.cid, {
          pinned: updatedPinned
        });
      }
    };

    await PinningServiceManager.pinToMultipleServices(
      fileMetadata,
      services,
      pinningProgress
    );
  }

  private static determineContentType(mimeType: string): FileMetadata['contentType'] {
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'binary';
  }

  private static async parseCID(cidString: string): Promise<{ version: 0 | 1; multihashCode: number }> {
    try {
      // Import CID parser
      const { CID } = await import('multiformats/cid');
      const cid = CID.parse(cidString);
      
      return {
        version: cid.version as 0 | 1,
        multihashCode: cid.multihash.code
      };
    } catch (error) {
      console.warn('Failed to parse CID, using defaults:', error);
      return {
        version: 1,
        multihashCode: 0x12 // sha2-256
      };
    }
  }

  private static getHasherName(multihashCode: number): string {
    const hasherMap: Record<number, string> = {
      0x12: 'sha2-256',
      0x13: 'sha2-512',
      0xb220: 'blake2b-256',
      0x1e: 'blake3'
    };
    
    return hasherMap[multihashCode] || 'sha2-256';
  }
}