import { FileMetadata } from './components/types';

export interface FileTypeInfo {
  mimeType: string;
  contentType: FileMetadata['contentType'];
  category: string;
  icon: string;
  extensions: string[];
}

export class ContentTypeUtils {
  private static readonly FILE_TYPE_MAP = new Map<string, FileTypeInfo>([
    // Text files
    ['txt', { mimeType: 'text/plain', contentType: 'text', category: 'Document', icon: '📄', extensions: ['txt'] }],
    ['md', { mimeType: 'text/markdown', contentType: 'text', category: 'Document', icon: '📝', extensions: ['md', 'markdown'] }],
    ['json', { mimeType: 'application/json', contentType: 'text', category: 'Data', icon: '📋', extensions: ['json'] }],
    ['xml', { mimeType: 'application/xml', contentType: 'text', category: 'Data', icon: '📋', extensions: ['xml'] }],
    ['csv', { mimeType: 'text/csv', contentType: 'text', category: 'Data', icon: '📊', extensions: ['csv'] }],
    ['yaml', { mimeType: 'application/x-yaml', contentType: 'text', category: 'Data', icon: '📋', extensions: ['yaml', 'yml'] }],
    ['log', { mimeType: 'text/plain', contentType: 'text', category: 'System', icon: '📜', extensions: ['log'] }],

    // Image files
    ['jpg', { mimeType: 'image/jpeg', contentType: 'image', category: 'Image', icon: '🖼️', extensions: ['jpg', 'jpeg'] }],
    ['png', { mimeType: 'image/png', contentType: 'image', category: 'Image', icon: '🖼️', extensions: ['png'] }],
    ['gif', { mimeType: 'image/gif', contentType: 'image', category: 'Image', icon: '🖼️', extensions: ['gif'] }],
    ['webp', { mimeType: 'image/webp', contentType: 'image', category: 'Image', icon: '🖼️', extensions: ['webp'] }],
    ['svg', { mimeType: 'image/svg+xml', contentType: 'image', category: 'Vector', icon: '🎨', extensions: ['svg'] }],
    ['bmp', { mimeType: 'image/bmp', contentType: 'image', category: 'Image', icon: '🖼️', extensions: ['bmp'] }],
    ['ico', { mimeType: 'image/x-icon', contentType: 'image', category: 'Image', icon: '🖼️', extensions: ['ico'] }],

    // Video files
    ['mp4', { mimeType: 'video/mp4', contentType: 'video', category: 'Video', icon: '🎥', extensions: ['mp4'] }],
    ['webm', { mimeType: 'video/webm', contentType: 'video', category: 'Video', icon: '🎥', extensions: ['webm'] }],
    ['avi', { mimeType: 'video/x-msvideo', contentType: 'video', category: 'Video', icon: '🎥', extensions: ['avi'] }],
    ['mov', { mimeType: 'video/quicktime', contentType: 'video', category: 'Video', icon: '🎥', extensions: ['mov'] }],
    ['wmv', { mimeType: 'video/x-ms-wmv', contentType: 'video', category: 'Video', icon: '🎥', extensions: ['wmv'] }],
    ['mkv', { mimeType: 'video/x-matroska', contentType: 'video', category: 'Video', icon: '🎥', extensions: ['mkv'] }],

    // Audio files
    ['mp3', { mimeType: 'audio/mpeg', contentType: 'audio', category: 'Audio', icon: '🎵', extensions: ['mp3'] }],
    ['wav', { mimeType: 'audio/wav', contentType: 'audio', category: 'Audio', icon: '🎵', extensions: ['wav'] }],
    ['ogg', { mimeType: 'audio/ogg', contentType: 'audio', category: 'Audio', icon: '🎵', extensions: ['ogg'] }],
    ['flac', { mimeType: 'audio/flac', contentType: 'audio', category: 'Audio', icon: '🎵', extensions: ['flac'] }],
    ['aac', { mimeType: 'audio/aac', contentType: 'audio', category: 'Audio', icon: '🎵', extensions: ['aac'] }],

    // Archive files
    ['zip', { mimeType: 'application/zip', contentType: 'binary', category: 'Archive', icon: '📦', extensions: ['zip'] }],
    ['tar', { mimeType: 'application/x-tar', contentType: 'binary', category: 'Archive', icon: '📦', extensions: ['tar'] }],
    ['gz', { mimeType: 'application/gzip', contentType: 'binary', category: 'Archive', icon: '📦', extensions: ['gz'] }],
    ['rar', { mimeType: 'application/vnd.rar', contentType: 'binary', category: 'Archive', icon: '📦', extensions: ['rar'] }],
    ['7z', { mimeType: 'application/x-7z-compressed', contentType: 'binary', category: 'Archive', icon: '📦', extensions: ['7z'] }],

    // Document files
    ['pdf', { mimeType: 'application/pdf', contentType: 'binary', category: 'Document', icon: '📄', extensions: ['pdf'] }],
    ['doc', { mimeType: 'application/msword', contentType: 'binary', category: 'Document', icon: '📄', extensions: ['doc'] }],
    ['docx', { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contentType: 'binary', category: 'Document', icon: '📄', extensions: ['docx'] }],
    ['xls', { mimeType: 'application/vnd.ms-excel', contentType: 'binary', category: 'Spreadsheet', icon: '📊', extensions: ['xls'] }],
    ['xlsx', { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', contentType: 'binary', category: 'Spreadsheet', icon: '📊', extensions: ['xlsx'] }],
    ['ppt', { mimeType: 'application/vnd.ms-powerpoint', contentType: 'binary', category: 'Presentation', icon: '📈', extensions: ['ppt'] }],
    ['pptx', { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', contentType: 'binary', category: 'Presentation', icon: '📈', extensions: ['pptx'] }],

    // Code files
    ['js', { mimeType: 'application/javascript', contentType: 'text', category: 'Code', icon: '💻', extensions: ['js'] }],
    ['ts', { mimeType: 'application/typescript', contentType: 'text', category: 'Code', icon: '💻', extensions: ['ts'] }],
    ['html', { mimeType: 'text/html', contentType: 'text', category: 'Code', icon: '🌐', extensions: ['html', 'htm'] }],
    ['css', { mimeType: 'text/css', contentType: 'text', category: 'Code', icon: '🎨', extensions: ['css'] }],
    ['py', { mimeType: 'text/x-python', contentType: 'text', category: 'Code', icon: '🐍', extensions: ['py'] }],
    ['java', { mimeType: 'text/x-java-source', contentType: 'text', category: 'Code', icon: '☕', extensions: ['java'] }],
    ['cpp', { mimeType: 'text/x-c++src', contentType: 'text', category: 'Code', icon: '⚡', extensions: ['cpp', 'cc', 'cxx'] }],
    ['c', { mimeType: 'text/x-csrc', contentType: 'text', category: 'Code', icon: '⚡', extensions: ['c'] }],
    ['rs', { mimeType: 'text/x-rust', contentType: 'text', category: 'Code', icon: '🦀', extensions: ['rs'] }],
    ['go', { mimeType: 'text/x-go', contentType: 'text', category: 'Code', icon: '🐹', extensions: ['go'] }],
    ['php', { mimeType: 'text/x-php', contentType: 'text', category: 'Code', icon: '🐘', extensions: ['php'] }],
    ['rb', { mimeType: 'text/x-ruby', contentType: 'text', category: 'Code', icon: '💎', extensions: ['rb'] }]
  ]);

  static getFileTypeInfo(filename: string): FileTypeInfo {
    const extension = this.getFileExtension(filename).toLowerCase();
    
    return this.FILE_TYPE_MAP.get(extension) || {
      mimeType: 'application/octet-stream',
      contentType: 'binary',
      category: 'Unknown',
      icon: '📁',
      extensions: [extension]
    };
  }

  static getMimeType(filename: string): string {
    return this.getFileTypeInfo(filename).mimeType;
  }

  static getContentType(filename: string): FileMetadata['contentType'] {
    return this.getFileTypeInfo(filename).contentType;
  }

  static getFileIcon(filename: string): string {
    return this.getFileTypeInfo(filename).icon;
  }

  static getFileCategory(filename: string): string {
    return this.getFileTypeInfo(filename).category;
  }

  static isTextFile(filename: string): boolean {
    return this.getContentType(filename) === 'text';
  }

  static isImageFile(filename: string): boolean {
    return this.getContentType(filename) === 'image';
  }

  static isVideoFile(filename: string): boolean {
    return this.getContentType(filename) === 'video';
  }

  static isAudioFile(filename: string): boolean {
    return this.getContentType(filename) === 'audio';
  }

  static isBinaryFile(filename: string): boolean {
    return this.getContentType(filename) === 'binary';
  }

  static isCodeFile(filename: string): boolean {
    const info = this.getFileTypeInfo(filename);
    return info.category === 'Code';
  }

  static isArchiveFile(filename: string): boolean {
    const info = this.getFileTypeInfo(filename);
    return info.category === 'Archive';
  }

  static canPreview(filename: string): boolean {
    const contentType = this.getContentType(filename);
    return ['text', 'image'].includes(contentType);
  }

  static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
      return '';
    }
    return filename.substring(lastDotIndex + 1);
  }

  static getFileNameWithoutExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return filename;
    }
    return filename.substring(0, lastDotIndex);
  }

  static getAllSupportedExtensions(): string[] {
    const extensions: string[] = [];
    this.FILE_TYPE_MAP.forEach((info) => {
      extensions.push(...info.extensions);
    });
    return [...new Set(extensions)].sort();
  }

  static getExtensionsByCategory(category: string): string[] {
    const extensions: string[] = [];
    this.FILE_TYPE_MAP.forEach((info) => {
      if (info.category === category) {
        extensions.push(...info.extensions);
      }
    });
    return [...new Set(extensions)].sort();
  }

  static detectMimeTypeFromBuffer(buffer: Uint8Array, filename?: string): string {
    const signatures = [
      { signature: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg', offset: 0 },
      { signature: [0x89, 0x50, 0x4E, 0x47], mimeType: 'image/png', offset: 0 },
      { signature: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif', offset: 0 },
      { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', offset: 0 },
      { signature: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', offset: 0 },
      { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/zip', offset: 0 },
      { signature: [0x50, 0x4B, 0x05, 0x06], mimeType: 'application/zip', offset: 0 },
      { signature: [0x1F, 0x8B], mimeType: 'application/gzip', offset: 0 },
      { signature: [0x7F, 0x45, 0x4C, 0x46], mimeType: 'application/x-executable', offset: 0 }
    ];

    for (const { signature, mimeType, offset } of signatures) {
      if (this.checkSignature(buffer, signature, offset)) {
        return mimeType;
      }
    }

    if (filename) {
      return this.getMimeType(filename);
    }

    if (this.isLikelyText(buffer)) {
      return 'text/plain';
    }

    return 'application/octet-stream';
  }

  private static checkSignature(buffer: Uint8Array, signature: number[], offset: number): boolean {
    if (buffer.length < offset + signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  private static isLikelyText(buffer: Uint8Array): boolean {
    if (buffer.length === 0) return false;

    const sampleSize = Math.min(1024, buffer.length);
    let textBytes = 0;

    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      
      if ((byte >= 0x20 && byte <= 0x7E) || // printable ASCII
          byte === 0x09 || // tab
          byte === 0x0A || // line feed
          byte === 0x0D) { // carriage return
        textBytes++;
      } else if (byte === 0x00) {
        return false;
      }
    }

    return (textBytes / sampleSize) > 0.7;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
  }

  static getReadableFileType(filename: string): string {
    const info = this.getFileTypeInfo(filename);
    const extension = this.getFileExtension(filename).toUpperCase();
    
    if (extension) {
      return `${extension} ${info.category}`;
    }
    
    return info.category;
  }
}