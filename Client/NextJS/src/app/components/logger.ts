export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  maxEntries: number;
  enableConsoleOutput: boolean;
  enablePersistence: boolean;
  categories: string[];
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private subscribers: ((entry: LogEntry) => void)[] = [];

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      maxEntries: 1000,
      enableConsoleOutput: true,
      enablePersistence: false,
      categories: [],
      ...config
    };
    
    if (this.config.enablePersistence) {
      this.loadPersistedLogs();
    }
  }

  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private readonly levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levelOrder[level] >= this.levelOrder[this.config.level];
  }

  private addEntry(level: LogLevel, message: string, category?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      category,
      metadata
    };

    this.logs.push(entry);
    
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries);
    }

    if (this.config.enableConsoleOutput) {
      this.outputToConsole(entry);
    }

    if (this.config.enablePersistence) {
      this.persistLogs();
    }

    this.subscribers.forEach(callback => callback(entry));
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const category = entry.category ? `[${entry.category}]` : '';
    const logMessage = `${timestamp} ${category} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(logMessage, entry.metadata);
        break;
      case 'info':
        console.info(logMessage, entry.metadata);
        break;
      case 'warn':
        console.warn(logMessage, entry.metadata);
        break;
      case 'error':
        console.error(logMessage, entry.metadata);
        break;
    }
  }

  debug(message: string, category?: string, metadata?: Record<string, any>): void {
    this.addEntry('debug', message, category, metadata);
  }

  info(message: string, category?: string, metadata?: Record<string, any>): void {
    this.addEntry('info', message, category, metadata);
  }

  warn(message: string, category?: string, metadata?: Record<string, any>): void {
    this.addEntry('warn', message, category, metadata);
  }

  error(message: string, category?: string, metadata?: Record<string, any>): void {
    this.addEntry('error', message, category, metadata);
  }

  getLogs(level?: LogLevel, category?: string, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;

    if (level) {
      const minLevel = this.levelOrder[level];
      filteredLogs = filteredLogs.filter(log => this.levelOrder[log.level] >= minLevel);
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  getRecentLogs(count: number = 20): LogEntry[] {
    return this.logs.slice(-count);
  }

  subscribe(callback: (entry: LogEntry) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  clear(): void {
    this.logs = [];
    if (this.config.enablePersistence) {
      this.clearPersistedLogs();
    }
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.info(`Log level changed to: ${level}`, 'logger');
  }

  setMaxEntries(maxEntries: number): void {
    this.config.maxEntries = maxEntries;
    if (this.logs.length > maxEntries) {
      this.logs = this.logs.slice(-maxEntries);
    }
    this.info(`Max log entries changed to: ${maxEntries}`, 'logger');
  }

  enableConsoleOutput(enable: boolean): void {
    this.config.enableConsoleOutput = enable;
    this.info(`Console output ${enable ? 'enabled' : 'disabled'}`, 'logger');
  }

  enablePersistence(enable: boolean): void {
    this.config.enablePersistence = enable;
    if (enable) {
      this.persistLogs();
    } else {
      this.clearPersistedLogs();
    }
    this.info(`Log persistence ${enable ? 'enabled' : 'disabled'}`, 'logger');
  }

  private persistLogs(): void {
    try {
      const serialized = JSON.stringify(this.logs);
      localStorage.setItem('ipfs-client-logs', serialized);
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }

  private loadPersistedLogs(): void {
    try {
      const stored = localStorage.getItem('ipfs-client-logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load persisted logs:', error);
    }
  }

  private clearPersistedLogs(): void {
    try {
      localStorage.removeItem('ipfs-client-logs');
    } catch (error) {
      console.error('Failed to clear persisted logs:', error);
    }
  }

  exportLogs(format: 'json' | 'csv' | 'txt' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logs, null, 2);
      
      case 'csv':
        const headers = 'Timestamp,Level,Category,Message,Metadata\n';
        const rows = this.logs.map(log => 
          `${new Date(log.timestamp).toISOString()},${log.level},${log.category || ''},${JSON.stringify(log.message)},${JSON.stringify(log.metadata || {})}`
        ).join('\n');
        return headers + rows;
      
      case 'txt':
        return this.logs.map(log => 
          `${new Date(log.timestamp).toISOString()} [${log.level.toUpperCase()}] ${log.category ? `[${log.category}] ` : ''}${log.message}${log.metadata ? ` ${JSON.stringify(log.metadata)}` : ''}`
        ).join('\n');
      
      default:
        return JSON.stringify(this.logs, null, 2);
    }
  }

  getLogStats(): Record<string, any> {
    const stats = {
      totalLogs: this.logs.length,
      byLevel: {} as Record<LogLevel, number>,
      byCategory: {} as Record<string, number>,
      timeRange: {
        oldest: this.logs.length > 0 ? Math.min(...this.logs.map(l => l.timestamp)) : null,
        newest: this.logs.length > 0 ? Math.max(...this.logs.map(l => l.timestamp)) : null
      },
      config: this.config
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      if (log.category) {
        stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      }
    });

    return stats;
  }

  searchLogs(query: string, field?: 'message' | 'category'): LogEntry[] {
    const searchTerm = query.toLowerCase();
    return this.logs.filter(log => {
      if (field === 'message') {
        return log.message.toLowerCase().includes(searchTerm);
      } else if (field === 'category') {
        return log.category?.toLowerCase().includes(searchTerm) || false;
      } else {
        return log.message.toLowerCase().includes(searchTerm) ||
               log.category?.toLowerCase().includes(searchTerm) ||
               false;
      }
    });
  }

  filterLogsByTimeRange(startTime: number, endTime: number): LogEntry[] {
    return this.logs.filter(log => 
      log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  createChildLogger(category: string): {
    debug: (message: string, metadata?: Record<string, any>) => void;
    info: (message: string, metadata?: Record<string, any>) => void;
    warn: (message: string, metadata?: Record<string, any>) => void;
    error: (message: string, metadata?: Record<string, any>) => void;
  } {
    return {
      debug: (message: string, metadata?: Record<string, any>) => 
        this.debug(message, category, metadata),
      info: (message: string, metadata?: Record<string, any>) => 
        this.info(message, category, metadata),
      warn: (message: string, metadata?: Record<string, any>) => 
        this.warn(message, category, metadata),
      error: (message: string, metadata?: Record<string, any>) => 
        this.error(message, category, metadata),
    };
  }
}