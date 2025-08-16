export enum ErrorType {
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  STORAGE = 'STORAGE',
  ENCRYPTION = 'ENCRYPTION',
  IPFS = 'IPFS',
  PINNING = 'PINNING',
  SHARDING = 'SHARDING',
  AUTH = 'AUTH',
  QUOTA = 'QUOTA',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface IPFSError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  details?: Record<string, any> | undefined;
  timestamp: number;
  stack?: string;
  retry?: boolean;
  userMessage?: string;
}

export interface ErrorContext {
  operation?: string;
  cid?: string;
  filename?: string;
  serviceId?: string;
  peerId?: string;
  size?: number;
}

export class ErrorHandler {
  private static readonly ERROR_STORAGE_KEY = 'ipfs-client-errors';
  private static readonly MAX_STORED_ERRORS = 100;
  private static errorListeners: Set<(error: IPFSError) => void> = new Set();

  static createError(
    type: ErrorType,
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ): IPFSError {
    const severity = this.determineSeverity(type, message);
    
    return {
      type,
      severity,
      message,
      code: this.generateErrorCode(type),
      details: context,
      timestamp: Date.now(),
      stack: originalError?.stack,
      retry: this.isRetryable(type),
      userMessage: this.generateUserMessage(type, message, context)
    };
  }

  static handleError(
    error: Error | IPFSError,
    context?: ErrorContext,
    type?: ErrorType
  ): IPFSError {
    let ipfsError: IPFSError;

    if (this.isIPFSError(error)) {
      ipfsError = error;
    } else {
      const errorType = type || this.inferErrorType(error.message);
      ipfsError = this.createError(errorType, error.message, context, error);
    }

    this.logError(ipfsError);
    this.storeError(ipfsError);
    this.notifyListeners(ipfsError);

    return ipfsError;
  }

  static logError(error: IPFSError): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `[${error.type}] ${error.message}`;
    
    switch (logLevel) {
      case 'error':
        console.error(message, error);
        break;
      case 'warn':
        console.warn(message, error);
        break;
      case 'info':
        console.info(message, error);
        break;
      default:
        console.log(message, error);
    }
  }

  static storeError(error: IPFSError): void {
    try {
      const storedErrors = this.getStoredErrors();
      storedErrors.unshift(error);
      
      if (storedErrors.length > this.MAX_STORED_ERRORS) {
        storedErrors.splice(this.MAX_STORED_ERRORS);
      }
      
      localStorage.setItem(this.ERROR_STORAGE_KEY, JSON.stringify(storedErrors));
    } catch (storageError) {
      console.warn('Failed to store error:', storageError);
    }
  }

  static getStoredErrors(): IPFSError[] {
    try {
      const stored = localStorage.getItem(this.ERROR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static clearStoredErrors(): void {
    try {
      localStorage.removeItem(this.ERROR_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear stored errors:', error);
    }
  }

  static addErrorListener(listener: (error: IPFSError) => void): void {
    this.errorListeners.add(listener);
  }

  static removeErrorListener(listener: (error: IPFSError) => void): void {
    this.errorListeners.delete(listener);
  }

  static getRecentErrors(count: number = 10): IPFSError[] {
    return this.getStoredErrors().slice(0, count);
  }

  static getErrorsByType(type: ErrorType): IPFSError[] {
    return this.getStoredErrors().filter(error => error.type === type);
  }

  static getErrorsBySeverity(severity: ErrorSeverity): IPFSError[] {
    return this.getStoredErrors().filter(error => error.severity === severity);
  }

  static getErrorStats(): Record<ErrorType, number> {
    const errors = this.getStoredErrors();
    const stats: Record<string, number> = {};
    
    Object.values(ErrorType).forEach(type => {
      stats[type] = 0;
    });
    
    errors.forEach(error => {
      stats[error.type] = (stats[error.type] || 0) + 1;
    });
    
    return stats as Record<ErrorType, number>;
  }

  static isRetryableError(error: IPFSError): boolean {
    return error.retry === true;
  }

  static shouldShowToUser(error: IPFSError): boolean {
    return error.severity !== ErrorSeverity.LOW;
  }

  static formatErrorForUser(error: IPFSError): string {
    if (error.userMessage) {
      return error.userMessage;
    }
    
    return this.generateUserMessage(error.type, error.message, error.details);
  }

  private static isIPFSError(error: any): error is IPFSError {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  private static inferErrorType(message: string): ErrorType {
    const messageLC = message.toLowerCase();
    
    if (messageLC.includes('network') || messageLC.includes('fetch')) {
      return ErrorType.NETWORK;
    }
    
    if (messageLC.includes('storage') || messageLC.includes('localStorage')) {
      return ErrorType.STORAGE;
    }
    
    if (messageLC.includes('encrypt') || messageLC.includes('decrypt')) {
      return ErrorType.ENCRYPTION;
    }
    
    if (messageLC.includes('cid') || messageLC.includes('ipfs') || messageLC.includes('helia')) {
      return ErrorType.IPFS;
    }
    
    if (messageLC.includes('pin')) {
      return ErrorType.PINNING;
    }
    
    if (messageLC.includes('shard')) {
      return ErrorType.SHARDING;
    }
    
    if (messageLC.includes('auth') || messageLC.includes('token')) {
      return ErrorType.AUTH;
    }
    
    if (messageLC.includes('timeout')) {
      return ErrorType.TIMEOUT;
    }
    
    if (messageLC.includes('quota') || messageLC.includes('limit')) {
      return ErrorType.QUOTA;
    }
    
    if (messageLC.includes('invalid') || messageLC.includes('required')) {
      return ErrorType.VALIDATION;
    }
    
    return ErrorType.UNKNOWN;
  }

  private static determineSeverity(type: ErrorType, message: string): ErrorSeverity {
    switch (type) {
      case ErrorType.VALIDATION:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.NETWORK:
        return message.includes('timeout') ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH;
      
      case ErrorType.STORAGE:
        return message.includes('quota') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      
      case ErrorType.ENCRYPTION:
        return ErrorSeverity.HIGH;
      
      case ErrorType.IPFS:
        return ErrorSeverity.HIGH;
      
      case ErrorType.PINNING:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.SHARDING:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.AUTH:
        return ErrorSeverity.HIGH;
      
      case ErrorType.QUOTA:
        return ErrorSeverity.HIGH;
      
      case ErrorType.TIMEOUT:
        return ErrorSeverity.MEDIUM;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private static generateErrorCode(type: ErrorType): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    return `${type}_${timestamp}_${random}`.toUpperCase();
  }

  private static isRetryable(type: ErrorType): boolean {
    return [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.IPFS,
      ErrorType.PINNING
    ].includes(type);
  }

  private static generateUserMessage(
    type: ErrorType,
    message: string,
    context?: Record<string, any>
  ): string {
    switch (type) {
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.';
      
      case ErrorType.NETWORK:
        return 'Network connection failed. Please check your internet connection and try again.';
      
      case ErrorType.STORAGE:
        return 'Storage operation failed. You may be running low on space.';
      
      case ErrorType.ENCRYPTION:
        return 'Encryption/decryption failed. Please check your encryption settings.';
      
      case ErrorType.IPFS:
        return 'IPFS operation failed. The file may be unavailable or corrupted.';
      
      case ErrorType.PINNING:
        return 'Failed to pin file to service. Please check your service configuration.';
      
      case ErrorType.SHARDING:
        return 'File sharding failed. The file may be too large or corrupted.';
      
      case ErrorType.AUTH:
        return 'Authentication failed. Please check your access token.';
      
      case ErrorType.QUOTA:
        return 'Storage quota exceeded. Please free up space or upgrade your plan.';
      
      case ErrorType.TIMEOUT:
        return 'Operation timed out. Please try again.';
      
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private static getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'error';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  private static notifyListeners(error: IPFSError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  static createNetworkError(message: string, context?: ErrorContext): IPFSError {
    return this.createError(ErrorType.NETWORK, message, context);
  }

  static createValidationError(message: string, context?: ErrorContext): IPFSError {
    return this.createError(ErrorType.VALIDATION, message, context);
  }

  static createStorageError(message: string, context?: ErrorContext): IPFSError {
    return this.createError(ErrorType.STORAGE, message, context);
  }

  static createIPFSError(message: string, context?: ErrorContext): IPFSError {
    return this.createError(ErrorType.IPFS, message, context);
  }

  static createEncryptionError(message: string, context?: ErrorContext): IPFSError {
    return this.createError(ErrorType.ENCRYPTION, message, context);
  }

  static createPinningError(message: string, context?: ErrorContext): IPFSError {
    return this.createError(ErrorType.PINNING, message, context);
  }
}