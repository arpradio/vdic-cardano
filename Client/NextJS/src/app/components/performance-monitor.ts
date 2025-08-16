export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: 'network' | 'storage' | 'crypto' | 'general';
}

export interface OperationTiming {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface SystemStats {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesUploaded: number;
    bytesDownloaded: number;
    activeConnections: number;
    uploadSpeed: number;
    downloadSpeed: number;
  };
  storage: {
    filesStored: number;
    totalSize: number;
    cacheHits: number;
    cacheMisses: number;
  };
  operations: {
    successful: number;
    failed: number;
    pending: number;
    averageTime: number;
  };
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private timings: OperationTiming[] = [];
  private systemStats: SystemStats;
  private maxMetrics = 1000;
  private maxTimings = 500;
  private networkTracker = {
    bytesUploaded: 0,
    bytesDownloaded: 0,
    startTime: Date.now(),
    lastCheck: Date.now()
  };

  private constructor() {
    this.systemStats = this.initializeStats();
    this.startMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeStats(): SystemStats {
    return {
      memory: { used: 0, total: 0, percentage: 0 },
      network: { 
        bytesUploaded: 0, 
        bytesDownloaded: 0, 
        activeConnections: 0,
        uploadSpeed: 0,
        downloadSpeed: 0
      },
      storage: { 
        filesStored: 0, 
        totalSize: 0, 
        cacheHits: 0, 
        cacheMisses: 0 
      },
      operations: { 
        successful: 0, 
        failed: 0, 
        pending: 0, 
        averageTime: 0 
      }
    };
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5000);

    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordMetric({
            name: entry.name,
            value: entry.duration,
            unit: 'ms',
            timestamp: Date.now(),
            category: 'general'
          });
        });
      });

      try {
        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        console.warn('Performance Observer not fully supported');
      }
    }
  }

  private collectSystemMetrics(): void {
    if (typeof window !== 'undefined') {
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        this.systemStats.memory = {
          used: memoryInfo.usedJSHeapSize,
          total: memoryInfo.totalJSHeapSize,
          percentage: (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100
        };

        this.recordMetric({
          name: 'memory-usage',
          value: this.systemStats.memory.percentage,
          unit: '%',
          timestamp: Date.now(),
          category: 'general'
        });
      }

      this.updateNetworkSpeeds();
    }
  }

  private updateNetworkSpeeds(): void {
    const now = Date.now();
    const timeDiff = (now - this.networkTracker.lastCheck) / 1000;
    
    if (timeDiff > 0) {
      const uploadDiff = this.systemStats.network.bytesUploaded - this.networkTracker.bytesUploaded;
      const downloadDiff = this.systemStats.network.bytesDownloaded - this.networkTracker.bytesDownloaded;
      
      this.systemStats.network.uploadSpeed = uploadDiff / timeDiff;
      this.systemStats.network.downloadSpeed = downloadDiff / timeDiff;
      
      this.networkTracker.bytesUploaded = this.systemStats.network.bytesUploaded;
      this.networkTracker.bytesDownloaded = this.systemStats.network.bytesDownloaded;
      this.networkTracker.lastCheck = now;
    }
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  startTiming(operation: string, metadata?: Record<string, any>): string {
    const timingId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const timing: OperationTiming = {
      operation,
      startTime: Date.now(),
      metadata
    };
    
    this.timings.push(timing);
    this.systemStats.operations.pending++;
    
    return timingId;
  }

  endTiming(operation: string, success: boolean = true): void {
    const timingIndex = this.timings.findLastIndex(t => 
      t.operation === operation && !t.endTime
    );
    
    if (timingIndex !== -1) {
      const timing = this.timings[timingIndex];
      timing.endTime = Date.now();
      timing.duration = timing.endTime - timing.startTime;
      
      this.systemStats.operations.pending--;
      
      if (success) {
        this.systemStats.operations.successful++;
      } else {
        this.systemStats.operations.failed++;
      }
      
      this.updateAverageOperationTime();
      
      this.recordMetric({
        name: `operation-${operation}`,
        value: timing.duration,
        unit: 'ms',
        timestamp: Date.now(),
        category: this.categorizeOperation(operation)
      });
    }
    
    if (this.timings.length > this.maxTimings) {
      this.timings = this.timings.slice(-this.maxTimings);
    }
  }

  private categorizeOperation(operation: string): 'network' | 'storage' | 'crypto' | 'general' {
    if (operation.includes('upload') || operation.includes('download') || operation.includes('fetch')) {
      return 'network';
    }
    if (operation.includes('encrypt') || operation.includes('decrypt') || operation.includes('hash')) {
      return 'crypto';
    }
    if (operation.includes('store') || operation.includes('cache') || operation.includes('save')) {
      return 'storage';
    }
    return 'general';
  }

  private updateAverageOperationTime(): void {
    const completedTimings = this.timings.filter(t => t.duration !== undefined);
    if (completedTimings.length > 0) {
      const totalTime = completedTimings.reduce((sum, t) => sum + (t.duration || 0), 0);
      this.systemStats.operations.averageTime = totalTime / completedTimings.length;
    }
  }

  trackNetworkUsage(bytes: number, direction: 'upload' | 'download'): void {
    if (direction === 'upload') {
      this.systemStats.network.bytesUploaded += bytes;
    } else {
      this.systemStats.network.bytesDownloaded += bytes;
    }
    
    this.recordMetric({
      name: `network-${direction}`,
      value: bytes,
      unit: 'bytes',
      timestamp: Date.now(),
      category: 'network'
    });
  }

  trackStorageUsage(files: number, totalSize: number): void {
    this.systemStats.storage.filesStored = files;
    this.systemStats.storage.totalSize = totalSize;
    
    this.recordMetric({
      name: 'storage-files',
      value: files,
      unit: 'count',
      timestamp: Date.now(),
      category: 'storage'
    });
    
    this.recordMetric({
      name: 'storage-size',
      value: totalSize,
      unit: 'bytes',
      timestamp: Date.now(),
      category: 'storage'
    });
  }

  trackCachePerformance(hit: boolean): void {
    if (hit) {
      this.systemStats.storage.cacheHits++;
    } else {
      this.systemStats.storage.cacheMisses++;
    }
    
    const hitRate = this.getCacheHitRate();
    this.recordMetric({
      name: 'cache-hit-rate',
      value: hitRate,
      unit: '%',
      timestamp: Date.now(),
      category: 'storage'
    });
  }

  getCacheHitRate(): number {
    const total = this.systemStats.storage.cacheHits + this.systemStats.storage.cacheMisses;
    return total > 0 ? (this.systemStats.storage.cacheHits / total) * 100 : 0;
  }

  getMetrics(category?: string, timeRange?: { start: number; end: number }): PerformanceMetric[] {
    let filtered = this.metrics;
    
    if (category) {
      filtered = filtered.filter(m => m.category === category);
    }
    
    if (timeRange) {
      filtered = filtered.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }
    
    return filtered;
  }

  getAverageMetric(name: string, timeRange?: { start: number; end: number }): number {
    let metrics = this.metrics.filter(m => m.name === name);
    
    if (timeRange) {
      metrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }
    
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((total, m) => total + m.value, 0);
    return sum / metrics.length;
  }

  getSystemStats(): SystemStats {
    return { ...this.systemStats };
  }

  getOperationStats(operation: string): {
    count: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    successRate: number;
  } {
    const operationTimings = this.timings.filter(t => 
      t.operation === operation && t.duration !== undefined
    );
    
    if (operationTimings.length === 0) {
      return {
        count: 0,
        averageTime: 0,
        minTime: 0,
        maxTime: 0,
        successRate: 0
      };
    }
    
    const durations = operationTimings.map(t => t.duration!);
    const sum = durations.reduce((total, d) => total + d, 0);
    
    const operationMetrics = this.metrics.filter(m => m.name === `operation-${operation}`);
    const successfulOps = operationMetrics.length;
    const totalOps = this.timings.filter(t => t.operation === operation).length;
    
    return {
      count: operationTimings.length,
      averageTime: sum / operationTimings.length,
      minTime: Math.min(...durations),
      maxTime: Math.max(...durations),
      successRate: totalOps > 0 ? (successfulOps / totalOps) * 100 : 0
    };
  }

  generateReport(): {
    summary: Record<string, any>;
    metrics: PerformanceMetric[];
    timings: OperationTiming[];
    recommendations: string[];
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentMetrics = this.getMetrics(undefined, { start: oneHourAgo, end: now });
    const recommendations: string[] = [];
    
    if (this.systemStats.memory.percentage > 80) {
      recommendations.push('Memory usage is high (>80%). Consider clearing cache or reducing concurrent operations.');
    }
    
    if (this.systemStats.operations.failed / Math.max(this.systemStats.operations.successful, 1) > 0.1) {
      recommendations.push('Operation failure rate is high (>10%). Check network connectivity and service availability.');
    }
    
    const cacheHitRate = this.getCacheHitRate();
    if (cacheHitRate < 50) {
      recommendations.push('Cache hit rate is low (<50%). Consider optimizing caching strategy.');
    }
    
    if (this.systemStats.network.downloadSpeed < 1000) {
      recommendations.push('Download speed is slow (<1KB/s). Check network connection.');
    }
    
    return {
      summary: {
        totalMetrics: this.metrics.length,
        recentMetrics: recentMetrics.length,
        systemStats: this.systemStats,
        uptime: now - this.networkTracker.startTime,
        cacheHitRate
      },
      metrics: recentMetrics,
      timings: this.timings.slice(-50),
      recommendations
    };
  }

  reset(): void {
    this.metrics = [];
    this.timings = [];
    this.systemStats = this.initializeStats();
    this.networkTracker = {
      bytesUploaded: 0,
      bytesDownloaded: 0,
      startTime: Date.now(),
      lastCheck: Date.now()
    };
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = 'Timestamp,Name,Value,Unit,Category\n';
      const rows = this.metrics.map(m => 
        `${new Date(m.timestamp).toISOString()},${m.name},${m.value},${m.unit},${m.category}`
      ).join('\n');
      return headers + rows;
    }
    
    return JSON.stringify({
      metrics: this.metrics,
      timings: this.timings,
      systemStats: this.systemStats
    }, null, 2);
  }
}