export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ValidationUtils {
  static validateFile(file: File, maxSize: number = 100 * 1024 * 1024): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!file || !(file instanceof File)) {
      errors.push('Input must be a File object');
      return { valid: false, errors, warnings };
    }

    if (!file.name || typeof file.name !== 'string') {
      errors.push('File name is required');
    } else {
      if (file.name.length > 255) {
        warnings.push('File name is longer than 255 characters');
      }
      
      const sanitized = this.sanitizeFilename(file.name);
      if (sanitized !== file.name) {
        warnings.push('File name contains potentially unsafe characters');
      }
    }

    const sizeValidation = this.validateFileSize(file.size, maxSize);
    errors.push(...sizeValidation.errors);
    warnings.push(...sizeValidation.warnings);

    if (!file.type) {
      warnings.push('File has no MIME type specified');
    } else {
      const validMimeTypes = [
        'text/', 'image/', 'video/', 'audio/', 'application/',
        'font/', 'model/', 'multipart/', 'message/'
      ];
      
      const isValidMimeType = validMimeTypes.some(prefix => file.type.startsWith(prefix));
      if (!isValidMimeType) {
        warnings.push(`Unusual MIME type: ${file.type}`);
      }
    }

    if (file.lastModified && typeof file.lastModified === 'number') {
      if (file.lastModified > Date.now()) {
        warnings.push('File modification date is in the future');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateFileSize(size: number, maxSize: number = 100 * 1024 * 1024): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof size !== 'number' || size < 0) {
      errors.push('File size must be a non-negative number');
    } else {
      if (size === 0) {
        warnings.push('File is empty');
      }
      
      if (size > maxSize) {
        errors.push(`File size (${size}) exceeds maximum allowed size (${maxSize})`);
      }
      
      const warningSize = maxSize * 0.8;
      if (size > warningSize) {
        warnings.push(`File size (${size}) is approaching maximum limit`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateCIDArray(cids: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(cids)) {
      errors.push('CIDs must be provided as an array');
      return { valid: false, errors, warnings };
    }

    const uniqueCids = new Set<string>();
    
    cids.forEach((cid, index) => {
      if (typeof cid !== 'string') {
        errors.push(`CID at index ${index} must be a string`);
        return;
      }

      if (!cid.trim()) {
        errors.push(`CID at index ${index} cannot be empty`);
        return;
      }

      const trimmedCid = cid.trim();
      if (uniqueCids.has(trimmedCid)) {
        warnings.push(`Duplicate CID found: ${trimmedCid}`);
      } else {
        uniqueCids.add(trimmedCid);
      }

      if (!this.isValidCIDFormat(trimmedCid)) {
        errors.push(`Invalid CID format at index ${index}: ${trimmedCid}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static sanitizeFilename(filename: string): string {
    const sanitized = filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\./, '_')
      .replace(/\.$/, '_')
      .substring(0, 255);

    return sanitized || 'unnamed_file';
  }

  static isValidCIDFormat(cid: string): boolean {
    if (!cid || typeof cid !== 'string') {
      return false;
    }

    const cidPattern = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58}|z[1-9A-HJ-NP-Za-km-z]+)$/;
    return cidPattern.test(cid);
  }

  static validateEncryptionConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config || typeof config !== 'object') {
      errors.push('Encryption config must be an object');
      return { valid: false, errors, warnings };
    }

    if (typeof config.enabled !== 'boolean') {
      errors.push('Encryption enabled property must be a boolean');
    }

    if (config.enabled) {
      if (!config.algorithm || typeof config.algorithm !== 'string') {
        errors.push('Encryption algorithm must be specified when encryption is enabled');
      } else {
        const supportedAlgorithms = ['AES-GCM', 'AES-CBC', 'ChaCha20-Poly1305'];
        if (!supportedAlgorithms.includes(config.algorithm)) {
          warnings.push(`Unsupported encryption algorithm: ${config.algorithm}`);
        }
      }

      if (config.keyLength && typeof config.keyLength !== 'number') {
        errors.push('Key length must be a number');
      } else if (config.keyLength && config.keyLength < 128) {
        warnings.push('Key length is below recommended minimum (128 bits)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateShardingConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config || typeof config !== 'object') {
      errors.push('Sharding config must be an object');
      return { valid: false, errors, warnings };
    }

    if (typeof config.enabled !== 'boolean') {
      errors.push('Sharding enabled property must be a boolean');
    }

    if (config.enabled) {
      if (!config.chunkSize || typeof config.chunkSize !== 'number') {
        errors.push('Chunk size must be specified when sharding is enabled');
      } else {
        if (config.chunkSize < 1024) {
          warnings.push('Chunk size is very small, may impact performance');
        }
        
        if (config.chunkSize > 10 * 1024 * 1024) {
          warnings.push('Chunk size is very large, may impact memory usage');
        }
      }

      if (config.maxShards && typeof config.maxShards !== 'number') {
        errors.push('Max shards must be a number');
      } else if (config.maxShards && config.maxShards < 2) {
        errors.push('Max shards must be at least 2');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateDatastoreItem(item: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!item || typeof item !== 'object') {
      errors.push('Datastore item must be an object');
      return { valid: false, errors, warnings };
    }

    const requiredFields = ['cid', 'name', 'size', 'type', 'uploadedAt', 'downloadCount'];
    
    requiredFields.forEach(field => {
      if (!(field in item)) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    if (item.cid && !this.isValidCIDFormat(item.cid)) {
      errors.push('Invalid CID format');
    }

    if (item.size && (typeof item.size !== 'number' || item.size < 0)) {
      errors.push('Size must be a non-negative number');
    }

    if (item.downloadCount && (typeof item.downloadCount !== 'number' || item.downloadCount < 0)) {
      errors.push('Download count must be a non-negative number');
    }

    if (item.uploadedAt && typeof item.uploadedAt === 'string') {
      const date = new Date(item.uploadedAt);
      if (isNaN(date.getTime())) {
        errors.push('Invalid upload date format');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}