import { FileProcessingResult } from './interfaces';

export class ContentTypeHandler {
  private static readonly TEXT_TYPES = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'text/xml',
    'application/json',
    'application/xml',
    'application/javascript'
  ];

  private static readonly IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ];

  private static readonly VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/3gp'
  ];

  private static readonly AUDIO_TYPES = [
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/m4a',
    'audio/wma',
    'audio/mpeg'
  ];

  static getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'txt':
    case 'md':
    case 'html':
    case 'css':
    case 'js':
    case 'json':
    case 'xml':
      return 'text';
    
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'tiff':
      return 'image';
    
    case 'mp4':
    case 'webm':
    case 'ogg':
    case 'avi':
    case 'mov':
    case 'wmv':
    case 'flv':
    case '3gp':
      return 'video';
    
    case 'mp3':
    case 'wav':
    case 'aac':
    case 'flac':
    case 'm4a':
    case 'wma':
    case 'mpeg':
      return 'audio';
    
    default:
      return 'binary';
  }
}

static getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'txt': return 'text/plain';
    case 'html': return 'text/html';
    case 'css': return 'text/css';
    case 'js': return 'text/javascript';
    case 'json': return 'application/json';
    case 'xml': return 'application/xml';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mp3': return 'audio/mp3';
    case 'wav': return 'audio/wav';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

  static async processFile(file: File): Promise<FileProcessingResult> {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const mimeType = file.type || 'application/octet-stream';
    
    const contentType = this.determineContentType(mimeType, data);
    const metadata = await this.extractMetadata(file, data, contentType);

    return {
      data,
      contentType,
      mimeType,
      size: file.size,
      metadata
    };
  }

  static async processFromUint8Array(data: Uint8Array, filename?: string): Promise<FileProcessingResult> {
    const mimeType = this.detectMimeTypeFromBytes(data, filename);
    const contentType = this.determineContentType(mimeType, data);
    const metadata = this.extractMetadataFromBytes(data, contentType, filename);

    return {
      data,
      contentType,
      mimeType,
      size: data.length,
      metadata
    };
  }

  private static determineContentType(mimeType: string, data: Uint8Array): 'text' | 'image' | 'video' | 'audio' | 'binary' {
    if (this.TEXT_TYPES.includes(mimeType)) {
      return 'text';
    }
    if (this.IMAGE_TYPES.includes(mimeType)) {
      return 'image';
    }
    if (this.VIDEO_TYPES.includes(mimeType)) {
      return 'video';
    }
    if (this.AUDIO_TYPES.includes(mimeType)) {
      return 'audio';
    }

    if (this.isTextLikeContent(data)) {
      return 'text';
    }

    return 'binary';
  }

  private static isTextLikeContent(data: Uint8Array): boolean {
    if (data.length === 0) return false;
    
    const sample = data.slice(0, Math.min(1024, data.length));
    let textBytes = 0;
    
    for (const byte of sample) {
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textBytes++;
      }
    }
    
    return (textBytes / sample.length) > 0.7;
  }

  private static detectMimeTypeFromBytes(data: Uint8Array, filename?: string): string {
    if (data.length < 4) return 'application/octet-stream';

    const header = Array.from(data.slice(0, 16));
    
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return 'image/jpeg';
    }
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return 'image/png';
    }
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
      return 'image/gif';
    }
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      if (header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
        return 'image/webp';
      }
      return 'audio/wav';
    }
    if (header[0] === 0x66 && header[1] === 0x74 && header[2] === 0x79 && header[3] === 0x70) {
      return 'video/mp4';
    }
    if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
      return 'video/webm';
    }
    if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
      return 'audio/mp3';
    }

    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'txt': return 'text/plain';
        case 'html': return 'text/html';
        case 'css': return 'text/css';
        case 'js': return 'text/javascript';
        case 'json': return 'application/json';
        case 'xml': return 'application/xml';
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'mp3': return 'audio/mp3';
        case 'wav': return 'audio/wav';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
      }
    }

    return 'application/octet-stream';
  }

  private static async extractMetadata(file: File, data: Uint8Array, contentType: string): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {
      filename: file.name,
      lastModified: file.lastModified,
      size: file.size
    };

    switch (contentType) {
      case 'text':
        metadata.encoding = this.detectTextEncoding(data);
        if (file.type === 'application/json') {
          try {
            const text = new TextDecoder().decode(data);
            const parsed = JSON.parse(text);
            metadata.jsonValid = true;
            metadata.jsonKeys = Object.keys(parsed).length;
          } catch {
            metadata.jsonValid = false;
          }
        }
        break;
      
      case 'image':
        const imageMeta = this.extractImageMetadata(data, file.type);
        Object.assign(metadata, imageMeta);
        break;
      
      case 'video':
        metadata.estimatedDuration = 'unknown';
        break;
      
      case 'audio':
        metadata.estimatedDuration = 'unknown';
        break;
    }

    return metadata;
  }

  private static extractMetadataFromBytes(data: Uint8Array, contentType: string, filename?: string): Record<string, any> {
    const metadata: Record<string, any> = {
      size: data.length
    };

    if (filename) {
      metadata.filename = filename;
    }

    switch (contentType) {
      case 'text':
        metadata.encoding = this.detectTextEncoding(data);
        break;
      
      case 'image':
        const imageMeta = this.extractImageMetadata(data);
        Object.assign(metadata, imageMeta);
        break;
    }

    return metadata;
  }

  private static detectTextEncoding(data: Uint8Array): string {
    if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
      return 'utf-8-bom';
    }
    if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
      return 'utf-16le';
    }
    if (data.length >= 2 && data[0] === 0xFE && data[1] === 0xFF) {
      return 'utf-16be';
    }
    
    for (let i = 0; i < Math.min(data.length, 1024); i++) {
      if (data[i] > 127) {
        return 'utf-8';
      }
    }
    
    return 'ascii';
  }

  private static extractImageMetadata(data: Uint8Array, mimeType?: string): Record<string, any> {
    const metadata: Record<string, any> = {};

    if (mimeType === 'image/png' || (data[0] === 0x89 && data[1] === 0x50)) {
      const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
      const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
      metadata.width = width;
      metadata.height = height;
      metadata.colorDepth = data[24];
    } else if (mimeType === 'image/jpeg' || (data[0] === 0xFF && data[1] === 0xD8)) {
      let offset = 2;
      while (offset < data.length - 4) {
        if (data[offset] === 0xFF && data[offset + 1] === 0xC0) {
          const height = (data[offset + 5] << 8) | data[offset + 6];
          const width = (data[offset + 7] << 8) | data[offset + 8];
          metadata.width = width;
          metadata.height = height;
          break;
        }
        offset++;
      }
    } else if (mimeType === 'image/gif' || (data[0] === 0x47 && data[1] === 0x49)) {
      const width = data[6] | (data[7] << 8);
      const height = data[8] | (data[9] << 8);
      metadata.width = width;
      metadata.height = height;
    }

    return metadata;
  }

  static async convertToDisplayFormat(data: Uint8Array, contentType: string, mimeType: string): Promise<string | HTMLElement> {
    switch (contentType) {
      case 'text':
        return new TextDecoder().decode(data);
      
      case 'image':
      case 'video':
      case 'audio':
        const blob = new Blob([data.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        if (contentType === 'image') {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'IPFS content';
          img.style.maxWidth = '100%';
          return img;
        } else if (contentType === 'video') {
          const video = document.createElement('video');
          video.src = url;
          video.controls = true;
          video.style.maxWidth = '100%';
          return video;
        } else if (contentType === 'audio') {
          const audio = document.createElement('audio');
          audio.src = url;
          audio.controls = true;
          return audio;
        }
        break;
      
      default:
        return `Binary data (${data.length} bytes)`;
    }
    
    return 'Unknown content type';
  }
}