export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IPFSError {
  id: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: 'network' | 'storage' | 'crypto' | 'validation' | 'system' | 'user';
  timestamp: number;
  context?: Record<string, any>;
  stack?: string;
  recoverable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface ErrorRecoveryStrategy {
  canRecover: (error: IPFSError) => boolean;
  recover: (error: IPFSError) => Promise<boolean>;
  description: string;
}

export interface ErrorHandlerConfig {
  maxErrors: number;
  enableAutoRecovery: boolean;
  retryDelays: number[];
  notificationThreshold: ErrorSeverity;
  logErrors: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: IPFSError[] = [];
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private config: ErrorHandlerConfig;
  private errorListeners: ((error: IPFSError) => void)[] = [];

  private constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      maxErrors: 100,
      enableAutoRecovery: true,
      retryDelays: [1000, 3000, 5000, 10000],
      notificationThreshold: 'medium',
      logErrors: true,
      ...config
    };

    this.setupDefaultRecoveryStrategies();
  }

  static getInstance(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }
    return ErrorHandler.instance;
  }

  private setupDefaultRecoveryStrategies(): void {
    this.addRecoveryStrategy({
      canRecover: (error) => error.code === 'NETWORK_TIMEOUT' || error.code === 'CONNECTION_FAILED',
      recover: async (error) => {
        await this.delay(2000);
        return true;
      },
      description: 'Retry network operations after delay'
    });

    this.addRecoveryStrategy({
      canRecover: (error) => error.code === 'TEMPORARY_STORAGE_FULL',
      recover: async (error) => {
        try {
          await this.clearTemporaryStorage();
          return true;
        } catch {
          return false;
        }
      },
      description: 'Clear temporary storage and retry'
    });

    this.addRecoveryStrategy({
      canRecover: (error) => error.code === 'PEER_CONNECTION_LOST',
      recover: async (error) => {
        try {
          await this.reconnectToPeers();
          return true;
        } catch {
          return false;
        }
      },
      description: 'Attempt to reconnect to IPFS peers'
    });
  }

  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  async handleError(
    error: Error | string,
    context?: Record<string, any>,
    category: IPFSError['category'] = 'system'
  ): Promise<IPFSError> {
    const ipfsError: IPFSError = {
      id: this.generateErrorId(),
      code: this.extractErrorCode(error),
      message: typeof error === 'string' ? error : error.message,
      severity: this.determineSeverity(error, category),
      category,
      timestamp: Date.now(),
      context,
      stack: error instanceof Error ? error.stack : undefined,
      recoverable: this.isRecoverable(error),
      retryCount: 0,
      maxRetries: this.getMaxRetries(error)
    };

    this.errors.push(ipfsError);
    
    if (this.errors.length > this.config.maxErrors) {
      this.errors = this.errors.slice(-this.config.maxErrors);
    }

    if (this.config.logErrors) {
      this.logError(ipfsError);
    }

    this.notifyListeners(ipfsError);

    if (this.config.enableAutoRecovery && ipfsError.recoverable) {
      await this.attemptRecovery(ipfsError);
    }

    return ipfsError;
  }

  private async attemptRecovery(error: IPFSError): Promise<boolean> {
    if (!error.maxRetries || (error.retryCount || 0) >= error.maxRetries) {
      return false;
    }

    const strategy = this.recoveryStrategies.find(s => s.canRecover(error));
    if (!strategy) {
      return false;
    }

    error.retryCount = (error.retryCount || 0) + 1;
    
    const delay = this.config.retryDelays[Math.min(error.retryCount - 1, this.config.retryDelays.length - 1)] || 5000;
    await this.delay(delay);

    try {
      const recovered = await strategy.recover(error);
      if (recovered) {
        this.logRecovery(error, strategy.description);
        return true;
      }
    } catch (recoveryError) {
      await this.handleError(recoveryError, { originalError: error.id }, 'system');
    }

    return false;
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractErrorCode(error: Error | string): string {
    if (typeof error === 'string') {
      return 'CUSTOM_ERROR';
    }

    if (error.name) {
      return error.name.toUpperCase().replace(/\s+/g, '_');
    }

    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'NETWORK_TIMEOUT';
    if (message.includes('connection')) return 'CONNECTION_FAILED';
    if (message.includes('not found')) return 'RESOURCE_NOT_FOUND';
    if (message.includes('unauthorized')) return 'UNAUTHORIZED';
    if (message.includes('forbidden')) return 'FORBIDDEN';
    if (message.includes('storage') && message.includes('full')) return 'STORAGE_FULL';
    if (message.includes('invalid')) return 'INVALID_INPUT';
    if (message.includes('parse') || message.includes('json')) return 'PARSE_ERROR';
    if (message.includes('encrypt') || message.includes('decrypt')) return 'CRYPTO_ERROR';

    return 'UNKNOWN_ERROR';
  }

  private determineSeverity(error: Error | string, category: IPFSError['category']): ErrorSeverity {
    const errorCode = this.extractErrorCode(error);
    
    const criticalCodes = ['STORAGE_FULL', 'CRYPTO_ERROR', 'SYSTEM_FAILURE'];
    const highCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'CONNECTION_FAILED'];
    const mediumCodes = ['NETWORK_TIMEOUT', 'RESOURCE_NOT_FOUND', 'PARSE_ERROR'];
    
    if (criticalCodes.includes(errorCode)) return 'critical';
    if (highCodes.includes(errorCode)) return 'high';
    if (mediumCodes.includes(errorCode)) return 'medium';
    
    if (category === 'crypto' || category === 'storage') return 'high';
    if (category === 'network') return 'medium';
    
    return 'low';
  }

  private isRecoverable(error: Error | string): boolean {
    const errorCode = this.extractErrorCode(error);
    
    const nonRecoverableCodes = [
      'UNAUTHORIZED',
      'FORBIDDEN', 
      'INVALID_INPUT',
      'CRYPTO_ERROR',
      'PARSE_ERROR'
    ];
    
    return !nonRecoverableCodes.includes(errorCode);
  }

  private getMaxRetries(error: Error | string): number {
    const errorCode = this.extractErrorCode(error);
    
    switch (errorCode) {
      case 'NETWORK_TIMEOUT':
      case 'CONNECTION_FAILED':
        return 3;
      case 'TEMPORARY_STORAGE_FULL':
        return 2;
      case 'PEER_CONNECTION_LOST':
        return 5;
      default:
        return 1;
    }
  }

  private logError(error: IPFSError): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `[${error.category.toUpperCase()}] ${error.code}: ${error.message}`;
    
    switch (logLevel) {
      case 'error':
        console.error(message, error.context);
        break;
      case 'warn':
        console.warn(message, error.context);
        break;
      case 'info':
        console.info(message, error.context);
        break;
      default:
        console.log(message, error.context);
    }
  }

  private logRecovery(error: IPFSError, strategy: string): void {
    console.info(`Recovery successful for ${error.code} using strategy: ${strategy}`);
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'log';
    }
  }

  private notifyListeners(error: IPFSError): void {
    if (this.shouldNotify(error)) {
      this.errorListeners.forEach(listener => {
        try {
          listener(error);
        } catch (listenerError) {
          console.error('Error in error listener:', listenerError);
        }
      });
    }
  }

  private shouldNotify(error: IPFSError): boolean {
    const severityLevels: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3
    };
    
    return severityLevels[error.severity] >= severityLevels[this.config.notificationThreshold];
  }

  addErrorListener(listener: (error: IPFSError) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  getErrors(
    severity?: ErrorSeverity,
    category?: IPFSError['category'],
    timeRange?: { start: number; end: number }
  ): IPFSError[] {
    let filtered = this.errors;
    
    if (severity) {
      filtered = filtered.filter(error => error.severity === severity);
    }
    
    if (category) {
      filtered = filtered.filter(error => error.category === category);
    }
    
    if (timeRange) {
      filtered = filtered.filter(error => 
        error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
      );
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<IPFSError['category'], number>;
    recoveryRate: number;
    recentErrors: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    const byCategory: Record<IPFSError['category'], number> = {
      network: 0,
      storage: 0,
      crypto: 0,
      validation: 0,
      system: 0,
      user: 0
    };
    
    let recoveredErrors = 0;
    let recoverableErrors = 0;
    let recentErrors = 0;
    
    this.errors.forEach(error => {
      bySeverity[error.severity]++;
      byCategory[error.category]++;
      
      if (error.timestamp >= oneHourAgo) {
        recentErrors++;
      }
      
      if (error.recoverable) {
        recoverableErrors++;
        if (error.retryCount && error.retryCount > 0) {
          recoveredErrors++;
        }
      }
    });
    
    return {
      total: this.errors.length,
      bySeverity,
      byCategory,
      recoveryRate: recoverableErrors > 0 ? (recoveredErrors / recoverableErrors) * 100 : 0,
      recentErrors
    };
  }

  clearErrors(olderThan?: number): void {
    if (olderThan) {
      this.errors = this.errors.filter(error => error.timestamp > olderThan);
    } else {
      this.errors = [];
    }
  }

  exportErrors(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = 'Timestamp,ID,Code,Message,Severity,Category,Recoverable,RetryCount\n';
      const rows = this.errors.map(error => 
        `${new Date(error.timestamp).toISOString()},${error.id},${error.code},${JSON.stringify(error.message)},${error.severity},${error.category},${error.recoverable},${error.retryCount || 0}`
      ).join('\n');
      return headers + rows;
    }
    
    return JSON.stringify(this.errors, null, 2);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async clearTemporaryStorage(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('temp-') || key.includes('cache')) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  private async reconnectToPeers(): Promise<void> {
    console.log('Attempting to reconnect to IPFS peers...');
    await this.delay(1000);
  }

  async wrapAsyncOperation<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>,
    category: IPFSError['category'] = 'system'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const ipfsError = await this.handleError(error, context, category);
      throw ipfsError;
    }
  }

  createErrorBoundary(
    onError?: (error: IPFSError) => void
  ): <T>(operation: () => T) => T | null {
    return <T>(operation: () => T): T | null => {
      try {
        return operation();
      } catch (error) {
        this.handleError(error).then(ipfsError => {
          if (onError) {
            onError(ipfsError);
          }
        });
        return null;
      }
    };
  }
}