import { EncryptionResult } from './interfaces';

export class CryptoUtils {
  static async generateEncryptionKey(algorithm: 'AES-GCM' | 'AES-CTR', keyLength: 128 | 256): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: algorithm,
        length: keyLength,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async importKey(keyData: string, algorithm: 'AES-GCM' | 'AES-CTR'): Promise<CryptoKey> {
    const keyBytes = this.base64ToUint8Array(keyData);
    return await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer,
      { name: algorithm },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async exportKey(key: CryptoKey): Promise<string> {
    const keyData = await crypto.subtle.exportKey('raw', key);
    return this.uint8ArrayToBase64(new Uint8Array(keyData));
  }

  static async encryptData(
    data: Uint8Array, 
    key: CryptoKey, 
    algorithm: 'AES-GCM' | 'AES-CTR'
  ): Promise<EncryptionResult> {
    const iv = crypto.getRandomValues(new Uint8Array(algorithm === 'AES-GCM' ? 12 : 16));
    
    const cryptoParams = algorithm === 'AES-GCM' 
      ? { name: algorithm, iv }
      : { name: algorithm, counter: iv, length: 64 };
    
    const encrypted = await crypto.subtle.encrypt(cryptoParams, key, data);
    
    return { 
      encrypted: new Uint8Array(encrypted), 
      iv 
    };
  }

static async encrypt(data: Uint8Array, config: any): Promise<{ data: Uint8Array; key: string }> {
  const algorithm = config.algorithm || 'AES-GCM';
  const keyLength = config.keyLength || 256;
  
  const key = await this.generateEncryptionKey(algorithm, keyLength);
  const result = await this.encryptData(data, key, algorithm);
  
  const combinedData = this.combineEncryptedData(result.iv, result.encrypted);
  const exportedKey = await this.exportKey(key);
  
  return {
    data: combinedData,
    key: exportedKey
  };
}

static async decrypt(encryptedData: Uint8Array, keyString: string, config: any): Promise<Uint8Array> {
  const algorithm = config.algorithm || 'AES-GCM';
  
  const key = await this.importKey(keyString, algorithm);
  const { iv, encrypted } = this.separateEncryptedData(encryptedData, algorithm);
  
  return await this.decryptData(encrypted, key, iv, algorithm);
}

  static async decryptData(
    encryptedData: Uint8Array, 
    key: CryptoKey, 
    iv: Uint8Array, 
    algorithm: 'AES-GCM' | 'AES-CTR'
  ): Promise<Uint8Array> {
    const cryptoParams = algorithm === 'AES-GCM'
      ? { name: algorithm, iv }
      : { name: algorithm, counter: iv, length: 64 };
      
    const decrypted = await crypto.subtle.decrypt(cryptoParams, key, encryptedData);
    return new Uint8Array(decrypted);
  }

  static combineEncryptedData(iv: Uint8Array, encrypted: Uint8Array): Uint8Array {
    const combined = new Uint8Array(iv.length + encrypted.length);
    combined.set(iv);
    combined.set(encrypted, iv.length);
    return combined;
  }

  static separateEncryptedData(combinedData: Uint8Array, algorithm: 'AES-GCM' | 'AES-CTR'): { iv: Uint8Array; encrypted: Uint8Array } {
    const ivLength = algorithm === 'AES-GCM' ? 12 : 16;
    const iv = combinedData.slice(0, ivLength);
    const encrypted = combinedData.slice(ivLength);
    return { iv, encrypted };
  }

  private static uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  private static base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
  }

  static async hashData(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return this.uint8ArrayToBase64(hashArray);
  }

  static generateId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.uint8ArrayToBase64(array);
  }
}