import { FileMetadata, PeerConfig, PinningService, CIDOptions } from './types';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export class ValidationUtils {
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_FILENAME_LENGTH = 255;
  private static readonly VALID_CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58}|[a-z2-7]{59})$/;

  static validateFile(file: File): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!file.name || file.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'File name is required',
        code: 'REQUIRED'
      });
    }

    if (file.name.length > this.MAX_FILENAME_LENGTH) {
      errors.push({
        field: 'name',
        message: `File name must be less than ${this.MAX_FILENAME_LENGTH} characters`,
        code: 'TOO_LONG'
      });
    }

    if (file.size === 0) {
      warnings.push('File is empty');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      warnings.push(`File is large (${this.formatBytes(file.size)}). Consider enabling sharding.`);
    }

    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(file.name)) {
      errors.push({
        field: 'name',
        message: 'File name contains invalid characters',
        code: 'INVALID_CHARS'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateCID(cid: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!cid || cid.trim().length === 0) {
      errors.push({
        field: 'cid',
        message: 'CID is required',
        code: 'REQUIRED'
      });
    } else if (!this.VALID_CID_REGEX.test(cid)) {
      errors.push({
        field: 'cid',
        message: 'Invalid CID format',
        code: 'INVALID_FORMAT'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  static validatePeer(peer: Partial<PeerConfig>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!peer.name || peer.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Peer name is required',
        code: 'REQUIRED'
      });
    }

    if (!peer.multiaddr || peer.multiaddr.trim().length === 0) {
      errors.push({
        field: 'multiaddr',
        message: 'Multiaddr is required',
        code: 'REQUIRED'
      });
    } else if (!this.isValidMultiaddr(peer.multiaddr)) {
      errors.push({
        field: 'multiaddr',
        message: 'Invalid multiaddr format',
        code: 'INVALID_FORMAT'
      });
    }

    if (peer.name && peer.name.length > 100) {
      warnings.push('Peer name is quite long');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validatePinningService(service: Partial<PinningService>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!service.name || service.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Service name is required',
        code: 'REQUIRED'
      });
    }

    if (!service.endpoint || service.endpoint.trim().length === 0) {
      errors.push({
        field: 'endpoint',
        message: 'API endpoint is required',
        code: 'REQUIRED'
      });
    } else if (!this.isValidUrl(service.endpoint)) {
      errors.push({
        field: 'endpoint',
        message: 'Invalid API endpoint URL',
        code: 'INVALID_URL'
      });
    } else if (!service.endpoint.startsWith('https://')) {
      warnings.push('API endpoint should use HTTPS for security');
    }

    if (!service.accessToken || service.accessToken.trim().length === 0) {
      errors.push({
        field: 'accessToken',
        message: 'Access token is required',
        code: 'REQUIRED'
      });
    }

    if (!service.type) {
      errors.push({
        field: 'type',
        message: 'Service type is required',
        code: 'REQUIRED'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateCIDOptions(options: Partial<CIDOptions>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (options.version !== undefined && ![0, 1].includes(options.version)) {
      errors.push({
        field: 'version',
        message: 'CID version must be 0 or 1',
        code: 'INVALID_VALUE'
      });
    }

    if (options.version === 0) {
      warnings.push('CID v0 is legacy format. Consider using CID v1.');
    }

    const validCodecs = ['dag-pb', 'raw', 'dag-cbor'];
    if (options.codec && !validCodecs.includes(options.codec)) {
      errors.push({
        field: 'codec',
        message: `Codec must be one of: ${validCodecs.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }

    const validHashers = ['sha2-256', 'sha2-512', 'blake2b-256', 'blake3'];
    if (options.hasher && !validHashers.includes(options.hasher)) {
      errors.push({
        field: 'hasher',
        message: `Hasher must be one of: ${validHashers.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateEncryptionKey(key: string, algorithm: string, keySize: number): ValidationResult {
    const errors: ValidationError[] = [];

    if (!key || key.trim().length === 0) {
      errors.push({
        field: 'key',
        message: 'Encryption key is required',
        code: 'REQUIRED'
      });
      return { valid: false, errors, warnings: [] };
    }

    const expectedLength = keySize / 4; // hex string length
    if (key.length !== expectedLength) {
      errors.push({
        field: 'key',
        message: `Key length must be ${expectedLength} characters for ${keySize}-bit key`,
        code: 'INVALID_LENGTH'
      });
    }

    if (!/^[0-9a-fA-F]+$/.test(key)) {
      errors.push({
        field: 'key',
        message: 'Key must be a valid hexadecimal string',
        code: 'INVALID_FORMAT'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  static validateShardingOptions(fileSize: number, chunkSize: number, maxShards: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (chunkSize <= 0) {
      errors.push({
        field: 'chunkSize',
        message: 'Chunk size must be greater than 0',
        code: 'INVALID_VALUE'
      });
    }

    if (maxShards <= 0) {
      errors.push({
        field: 'maxShards',
        message: 'Max shards must be greater than 0',
        code: 'INVALID_VALUE'
      });
    }

    if (fileSize > 0 && chunkSize > 0) {
      const estimatedShards = Math.ceil(fileSize / chunkSize);
      
      if (estimatedShards > maxShards) {
        errors.push({
          field: 'chunkSize',
          message: `File would require ${estimatedShards} shards, but max is ${maxShards}. Increase chunk size.`,
          code: 'TOO_MANY_SHARDS'
        });
      }

      if (estimatedShards > 100) {
        warnings.push(`File will be split into ${estimatedShards} shards. This may impact performance.`);
      }
    }

    const minChunkSize = 64 * 1024; // 64KB
    if (chunkSize < minChunkSize) {
      warnings.push(`Chunk size is quite small (${this.formatBytes(chunkSize)}). Consider at least ${this.formatBytes(minChunkSize)}.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"|?*\x00-\x1f]/g, '_')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '')
      .substring(0, this.MAX_FILENAME_LENGTH);
  }

  static validateFileMetadata(metadata: Partial<FileMetadata>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!metadata.cid) {
      errors.push({
        field: 'cid',
        message: 'CID is required',
        code: 'REQUIRED'
      });
    } else {
      const cidValidation = this.validateCID(metadata.cid);
      errors.push(...cidValidation.errors);
    }

    if (!metadata.name || metadata.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'File name is required',
        code: 'REQUIRED'
      });
    }

    if (typeof metadata.size !== 'number' || metadata.size < 0) {
      errors.push({
        field: 'size',
        message: 'File size must be a non-negative number',
        code: 'INVALID_VALUE'
      });
    }

    if (metadata.size === 0) {
      warnings.push('File has zero size');
    }

    if (!metadata.mimeType) {
      warnings.push('MIME type not specified');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static isValidMultiaddr(multiaddr: string): boolean {
    return multiaddr.startsWith('/') && 
           (multiaddr.includes('/ip4/') || 
            multiaddr.includes('/ip6/') || 
            multiaddr.includes('/dns/') || 
            multiaddr.includes('/dnsaddr/'));
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}