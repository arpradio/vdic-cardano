import { EncryptionOptions } from './types';

export interface EncryptionResult {
  encryptedData: Uint8Array;
  key: string;
  iv: Uint8Array;
  algorithm: string;
}

export class CryptoUtils {
  static async encrypt(
    data: Uint8Array,
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    if (!options.enabled) {
      throw new Error('Encryption not enabled');
    }

    const algorithm = options.algorithm === 'AES-GCM' ? 'AES-GCM' : 'ChaCha20-Poly1305';
    const keySize = options.keySize;
    
    let cryptoKey: CryptoKey;
    let keyString: string;

    if (options.customKey) {
      keyString = options.customKey;
      const keyData = this.hexToUint8Array(options.customKey);
      cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: algorithm },
        false,
        ['encrypt']
      );
    } else {
      cryptoKey = await crypto.subtle.generateKey(
        {
          name: algorithm,
          length: keySize
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      const exportedKey = await crypto.subtle.exportKey('raw', cryptoKey);
      keyString = this.uint8ArrayToHex(new Uint8Array(exportedKey));
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: algorithm,
        iv: iv
      },
      cryptoKey,
      data
    );

    return {
      encryptedData: new Uint8Array(encryptedData),
      key: keyString,
      iv: iv,
      algorithm: algorithm
    };
  }

  static async decrypt(
    encryptedData: Uint8Array,
    keyString: string,
    iv: Uint8Array,
    algorithm: string
  ): Promise<Uint8Array> {
    const keyData = this.hexToUint8Array(keyString);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: algorithm },
      false,
      ['decrypt']
    );

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: algorithm,
        iv: iv
      },
      cryptoKey,
      encryptedData
    );

    return new Uint8Array(decryptedData);
  }

  static async generateKey(algorithm: string, keySize: number): Promise<string> {
    const key = await crypto.subtle.generateKey(
      {
        name: algorithm,
        length: keySize
      },
      true,
      ['encrypt', 'decrypt']
    );

    const exportedKey = await crypto.subtle.exportKey('raw', key);
    return this.uint8ArrayToHex(new Uint8Array(exportedKey));
  }

  static validateKey(keyString: string, algorithm: string, keySize: number): boolean {
    try {
      const keyData = this.hexToUint8Array(keyString);
      const expectedLength = keySize / 8;
      
      if (keyData.length !== expectedLength) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  static async deriveKeyFromPassword(
    password: string,
    salt: Uint8Array,
    iterations: number = 100000
  ): Promise<string> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const importedKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      importedKey,
      256
    );

    return this.uint8ArrayToHex(new Uint8Array(derivedBits));
  }

  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  static async hashData(data: Uint8Array, algorithm: string = 'SHA-256'): Promise<string> {
    const hashBuffer = await crypto.subtle.digest(algorithm, data);
    return this.uint8ArrayToHex(new Uint8Array(hashBuffer));
  }

  static uint8ArrayToHex(uint8Array: Uint8Array): string {
    return Array.from(uint8Array)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  static hexToUint8Array(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string length');
    }

    const uint8Array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      uint8Array[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return uint8Array;
  }

  static secureRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomBytes = crypto.getRandomValues(new Uint8Array(length));
    
    return Array.from(randomBytes)
      .map(byte => chars[byte % chars.length])
      .join('');
  }

  static async encryptWithMetadata(
    data: Uint8Array,
    options: EncryptionOptions
  ): Promise<{
    encryptedData: Uint8Array;
    metadata: {
      key: string;
      iv: string;
      algorithm: string;
      keySize: number;
      timestamp: number;
    }
  }> {
    const result = await this.encrypt(data, options);
    
    return {
      encryptedData: result.encryptedData,
      metadata: {
        key: result.key,
        iv: this.uint8ArrayToHex(result.iv),
        algorithm: result.algorithm,
        keySize: options.keySize,
        timestamp: Date.now()
      }
    };
  }

  static async decryptWithMetadata(
    encryptedData: Uint8Array,
    metadata: {
      key: string;
      iv: string;
      algorithm: string;
      keySize: number;
      timestamp: number;
    }
  ): Promise<Uint8Array> {
    const iv = this.hexToUint8Array(metadata.iv);
    return await this.decrypt(encryptedData, metadata.key, iv, metadata.algorithm);
  }
}