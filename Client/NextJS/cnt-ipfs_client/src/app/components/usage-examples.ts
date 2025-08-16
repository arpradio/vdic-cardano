import { 
  IPFSManager, 
  FileOperations, 
  ContentTypeHandler, 
  ConfigManager, 
  PinningManager,
  CryptoUtils,
  ShardingUtils,
  SearchFilter,
  Logger,
  ErrorHandler,
  CacheManager,
  PerformanceMonitor,
  CARHandler
} from './index';

export class UsageExamples {
  
  static async basicFileUploadExample() {
    console.log('=== Basic File Upload Example ===');
    
    try {
      const logger = Logger.getInstance();
      const errorHandler = ErrorHandler.getInstance();
      
      logger.info('Starting basic file upload example', 'example');
      
      await IPFSManager.loadLibraries();
      
      const config = ConfigManager.getDefaultConfig();
      const node = await IPFSManager.createNode(config.nodeConfig);
      
      const fileContent = new TextEncoder().encode('Hello, IPFS World!');
      const file = new File([fileContent], 'hello.txt', { type: 'text/plain' });
      
      const result = await FileOperations.uploadFile(
        file,
        config.encryptionConfig,
        config.shardingConfig,
        (message) => logger.info(message, 'upload')
      );
      
      if (result.success && result.item) {
        logger.info(`File uploaded successfully: ${result.item.cid}`, 'example');
        console.log('Uploaded file details:', result.item);
        return result.item;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      await errorHandler.handleError(error, { example: 'basicUpload' }, 'user');
      throw error;
    }
  }

  static async encryptedFileExample() {
    console.log('=== Encrypted File Upload Example ===');
    
    const logger = Logger.getInstance();
    const config = ConfigManager.getDefaultConfig();
    
    config.encryptionConfig = {
      enabled: true,
      algorithm: 'AES-GCM',
      keyLength: 256,
      generateKey: true
    };
    
    await IPFSManager.loadLibraries();
    const node = await IPFSManager.createNode(config.nodeConfig);
    
    const sensitiveData = new TextEncoder().encode('This is sensitive information');
    const file = new File([sensitiveData], 'sensitive.txt', { type: 'text/plain' });
    
    const result = await FileOperations.uploadFile(
      file,
      config.encryptionConfig,
      config.shardingConfig,
      (message) => logger.info(message, 'encrypted-upload')
    );
    
    if (result.success && result.item) {
      logger.info(`Encrypted file uploaded: ${result.item.cid}`, 'example');
      console.log('Encryption key:', result.item.encryptionKey);
      
      const downloadResult = await FileOperations.downloadFile(
        result.item,
        config.encryptionConfig,
        (message) => logger.info(message, 'encrypted-download')
      );
      
      if (downloadResult.success && downloadResult.data) {
        const decryptedText = new TextDecoder().decode(downloadResult.data);
        console.log('Decrypted content:', decryptedText);
      }
      
      return result.item;
    }
    
    throw new Error(result.error || 'Encrypted upload failed');
  }

  static async shardedFileExample() {
    console.log('=== Large File Sharding Example ===');
    
    const logger = Logger.getInstance();
    const config = ConfigManager.getDefaultConfig();
    
    config.shardingConfig = {
      enabled: true,
      chunkSize: 64 * 1024,
      maxShards: 10
    };
    
    await IPFSManager.loadLibraries();
    const node = await IPFSManager.createNode(config.nodeConfig);
    
    const largeData = new Uint8Array(200 * 1024);
    crypto.getRandomValues(largeData);
    const file = new File([largeData], 'large-file.bin', { type: 'application/octet-stream' });
    
    const result = await FileOperations.uploadFile(
      file,
      config.encryptionConfig,
      config.shardingConfig,
      (message) => logger.info(message, 'sharded-upload')
    );
    
    if (result.success && result.item) {
      logger.info(`Sharded file uploaded: ${result.item.cid}`, 'example');
      console.log(`File sharded into ${result.item.shardCount} pieces`);
      
      const downloadResult = await FileOperations.downloadFile(
        result.item,
        config.encryptionConfig,
        (message) => logger.info(message, 'sharded-download')
      );
      
      if (downloadResult.success && downloadResult.data) {
        console.log(`Reconstructed file size: ${downloadResult.data.length} bytes`);
        console.log(`Original file size: ${file.size} bytes`);
        console.log(`Integrity check: ${downloadResult.data.length === file.size ? 'PASS' : 'FAIL'}`);
      }
      
      return result.item;
    }
    
    throw new Error(result.error || 'Sharded upload failed');
  }

  static async contentTypeDetectionExample() {
    console.log('=== Content Type Detection Example ===');
    
    const examples = [
      { content: '{"hello": "world"}', name: 'data.json', type: 'application/json' },
      { content: '<html><body>Hello</body></html>', name: 'page.html', type: 'text/html' },
      { content: 'console.log("Hello");', name: 'script.js', type: 'text/javascript' }
    ];
    
    for (const example of examples) {
      const data = new TextEncoder().encode(example.content);
      const file = new File([data], example.name, { type: example.type });
      
      const processed = await ContentTypeHandler.processFile(file);
      
      console.log(`File: ${example.name}`);
      console.log(`  Detected Content Type: ${processed.contentType}`);
      console.log(`  MIME Type: ${processed.mimeType}`);
      console.log(`  Size: ${processed.size} bytes`);
      console.log(`  Metadata:`, processed.metadata);
      console.log('');
    }
  }

  static async pinningServiceExample() {
    console.log('=== Pinning Service Example ===');
    
    const logger = Logger.getInstance();
    const config = ConfigManager.getDefaultConfig();
    
    const customService = {
      id: 'custom-pinning',
      name: 'Custom Pinning Service',
      endpoint: 'https://api.example.com/pinning',
      accessToken: 'your-access-token-here',
      type: 'ipfs-pinning-service' as const,
      verified: false,
      enabled: true
    };
    
    config.pinningServices.push(customService);
    
    const testResult = await PinningManager.testService(customService);
    console.log(`Service test result: ${testResult.verified ? 'PASS' : 'FAIL'}`);
    
    if (testResult.error) {
      console.log(`Test error: ${testResult.error}`);
    }
    
    return testResult;
  }

  static async searchAndFilterExample() {
    console.log('=== Search and Filter Example ===');
    
    const sampleFiles = [
      {
        cid: 'QmHash1',
        name: 'document.pdf',
        size: 1024000,
        type: 'application/pdf',
        contentType: 'binary' as const,
        mimeType: 'application/pdf',
        timestamp: Date.now() - 86400000,
        encrypted: false,
        sharded: false,
        pinned: [],
        verified: true,
        downloadCount: 5,
        metadata: { tags: ['document', 'important'] }
      },
      {
        cid: 'QmHash2',
        name: 'image.jpg',
        size: 512000,
        type: 'image/jpeg',
        contentType: 'image' as const,
        mimeType: 'image/jpeg',
        timestamp: Date.now() - 43200000,
        encrypted: true,
        sharded: false,
        pinned: ['pinata'],
        verified: true,
        downloadCount: 2,
        metadata: { width: 1920, height: 1080 }
      },
      {
        cid: 'QmHash3',
        name: 'video.mp4',
        size: 50000000,
        type: 'video/mp4',
        contentType: 'video' as const,
        mimeType: 'video/mp4',
        timestamp: Date.now() - 21600000,
        encrypted: false,
        sharded: true,
        shardCount: 5,
        pinned: [],
        verified: false,
        downloadCount: 0,
        metadata: {}
      }
    ];
    
    console.log('Searching for encrypted files:');
    const encryptedResult = SearchFilter.search(sampleFiles, { encrypted: true });
    console.log(`Found ${encryptedResult.filteredCount} encrypted files`);
    
    console.log('\nSearching for files larger than 1MB:');
    const largeResult = SearchFilter.search(sampleFiles, { 
      sizeRange: { min: 1024 * 1024 } 
    });
    console.log(`Found ${largeResult.filteredCount} large files`);
    
    console.log('\nSearching for image files:');
    const imageResult = SearchFilter.search(sampleFiles, { 
      contentType: ['image'] 
    });
    console.log(`Found ${imageResult.filteredCount} image files`);
    
    console.log('\nFacet analysis:');
    console.log('Content types:', encryptedResult.facets.contentTypes);
    console.log('Size stats:', encryptedResult.facets.sizes);
    
    return {
      encrypted: encryptedResult,
      large: largeResult,
      images: imageResult
    };
  }

  static async performanceMonitoringExample() {
    console.log('=== Performance Monitoring Example ===');
    
    const monitor = PerformanceMonitor.getInstance();
    
    const uploadTiming = monitor.startTiming('example-upload');
    await new Promise(resolve => setTimeout(resolve, 1000));
    monitor.endTiming('example-upload', true);
    
    monitor.trackNetworkUsage(1024 * 1024, 'upload');
    monitor.trackNetworkUsage(512 * 1024, 'download');
    
    monitor.trackStorageUsage(10, 50 * 1024 * 1024);
    
    monitor.trackCachePerformance(true);
    monitor.trackCachePerformance(false);
    monitor.trackCachePerformance(true);
    
    const stats = monitor.getSystemStats();
    const operationStats = monitor.getOperationStats('example-upload');
    const report = monitor.generateReport();
    
    console.log('System Stats:', stats);
    console.log('Operation Stats:', operationStats);
    console.log('Performance Report:', report.summary);
    console.log('Recommendations:', report.recommendations);
    
    return { stats, operationStats, report };
  }

  static async cacheManagementExample() {
    console.log('=== Cache Management Example ===');
    
    const cache = CacheManager.getInstance({
      maxSize: 10 * 1024 * 1024,
      defaultTTL: 5 * 60 * 1000,
      enableCompression: true
    });
    
    const sampleData = {
      message: 'Hello from cache!',
      timestamp: Date.now(),
      data: new Array(1000).fill('cache test data')
    };
    
    await cache.set('test-key', sampleData);
    console.log('Data cached successfully');
    
    const retrieved = await cache.get('test-key');
    console.log('Retrieved from cache:', retrieved?.message);
    
    const hasKey = cache.has('test-key');
    console.log('Cache contains key:', hasKey);
    
    const stats = cache.getStats();
    console.log('Cache stats:', stats);
    
    const namespacedCache = cache.createNamespacedCache('user-files');
    await namespacedCache.set('file1', { name: 'document.pdf', size: 1024 });
    
    const userFile = await namespacedCache.get('file1');
    console.log('Namespaced cache retrieval:', userFile);
    
    return { stats, userFile };
  }

  static async carImportExportExample() {
    console.log('=== CAR Import/Export Example ===');
    
    const logger = Logger.getInstance();
    const config = ConfigManager.getDefaultConfig();
    
    await IPFSManager.loadLibraries();
    const node = await IPFSManager.createNode(config.nodeConfig);
    
    const files = [
      { content: 'File 1 content', name: 'file1.txt' },
      { content: 'File 2 content', name: 'file2.txt' },
      { content: 'File 3 content', name: 'file3.txt' }
    ];
    
    const items = [];
    
    for (const { content, name } of files) {
      const data = new TextEncoder().encode(content);
      const file = new File([data], name, { type: 'text/plain' });
      
      const result = await FileOperations.uploadFile(
        file,
        config.encryptionConfig,
        config.shardingConfig,
        (message) => logger.info(message, 'car-example')
      );
      
      if (result.success && result.item) {
        result.item.verified = true;
        items.push(result.item);
      }
    }
    
    console.log(`Uploaded ${items.length} files for CAR export`);
    
    const exportResult = await CARHandler.exportToCAR(items, {
      includePinned: true,
      includeUnverified: false,
      maxSize: 100 * 1024 * 1024,
      compression: true
    });
    
    if (exportResult.success && exportResult.data) {
      console.log(`CAR export successful: ${exportResult.data.length} bytes`);
      
      const importResult = await CARHandler.importFromCAR(exportResult.data, []);
      
      if (importResult.success) {
        console.log(`CAR import successful: ${importResult.importedItems.length} items imported`);
        console.log('Imported items:', importResult.importedItems.map(item => item.name));
      } else {
        console.log('CAR import failed:', importResult.errors);
      }
      
      return { exportResult, importResult };
    } else {
      throw new Error(exportResult.error || 'CAR export failed');
    }
  }

  static async errorHandlingExample() {
    console.log('=== Error Handling Example ===');
    
    const errorHandler = ErrorHandler.getInstance({
      enableAutoRecovery: true,
      retryDelays: [1000, 2000, 4000],
      notificationThreshold: 'medium'
    });
    
    errorHandler.addErrorListener((error) => {
      console.log(`Error notification: ${error.code} - ${error.message}`);
    });
    
    try {
      throw new Error('Network timeout occurred');
    } catch (error) {
      const ipfsError = await errorHandler.handleError(
        error,
        { operation: 'file-upload', attempt: 1 },
        'network'
      );
      
      console.log('Error handled:', ipfsError);
    }
    
    const networkOperation = async () => {
      await new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection failed')), 100);
      });
    };
    
    try {
      await errorHandler.wrapAsyncOperation(
        networkOperation,
        { operation: 'network-test' },
        'network'
      );
    } catch (error) {
      console.log('Wrapped operation failed:', error);
    }
    
    const errorStats = errorHandler.getErrorStats();
    console.log('Error statistics:', errorStats);
    
    return errorStats;
  }

  static async fullWorkflowExample() {
    console.log('=== Full Workflow Example ===');
    
    try {
      const logger = Logger.getInstance();
      const errorHandler = ErrorHandler.getInstance();
      const monitor = PerformanceMonitor.getInstance();
      const cache = CacheManager.getInstance();
      
      logger.info('Starting full workflow example', 'workflow');
      
      const workflowTiming = monitor.startTiming('full-workflow');
      
      await IPFSManager.loadLibraries();
      
      const config = ConfigManager.initializeConfig();
      config.encryptionConfig.enabled = true;
      config.shardingConfig.enabled = true;
      ConfigManager.saveConfig(config);
      
      const node = await IPFSManager.createNode(config.nodeConfig);
      
      const testData = new Uint8Array(2 * 1024 * 1024);
      crypto.getRandomValues(testData);
      const file = new File([testData], 'test-file.bin', { type: 'application/octet-stream' });
      
      const uploadResult = await FileOperations.uploadFile(
        file,
        config.encryptionConfig,
        config.shardingConfig,
        (message) => logger.info(message, 'workflow')
      );
      
      if (!uploadResult.success || !uploadResult.item) {
        throw new Error(uploadResult.error || 'Upload failed');
      }
      
      await cache.set(`file-${uploadResult.item.cid}`, uploadResult.item);
      
      const verifyResult = await FileOperations.verifyFile(uploadResult.item);
      logger.info(`File verification: ${verifyResult ? 'PASS' : 'FAIL'}`, 'workflow');
      
      const downloadResult = await FileOperations.downloadFile(
        uploadResult.item,
        config.encryptionConfig,
        (message) => logger.info(message, 'workflow')
      );
      
      if (!downloadResult.success || !downloadResult.data) {
        throw new Error(downloadResult.error || 'Download failed');
      }
      
      const dataMatch = downloadResult.data.length === testData.length;
      logger.info(`Data integrity check: ${dataMatch ? 'PASS' : 'FAIL'}`, 'workflow');
      
      const searchResult = SearchFilter.search([uploadResult.item], {
        encrypted: true,
        sharded: true
      });
      
      logger.info(`Search found ${searchResult.filteredCount} matching files`, 'workflow');
      
      monitor.endTiming('full-workflow', true);
      
      const performanceReport = monitor.generateReport();
      const cacheStats = cache.getStats();
      const errorStats = errorHandler.getErrorStats();
      
      console.log('Workflow completed successfully!');
      console.log('Performance Report:', performanceReport.summary);
      console.log('Cache Stats:', cacheStats);
      console.log('Error Stats:', errorStats);
      
      return {
        uploadedFile: uploadResult.item,
        dataIntegrityCheck: dataMatch,
        performanceReport,
        cacheStats,
        errorStats
      };
      
    } catch (error) {
      console.error('Full workflow failed:', error);
      throw error;
    }
  }

  static async runAllExamples() {
    console.log('🚀 Running all IPFS client examples...\n');
    
    try {
      await this.basicFileUploadExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.contentTypeDetectionExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.searchAndFilterExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.performanceMonitoringExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.cacheManagementExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.errorHandlingExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.encryptedFileExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.shardedFileExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.carImportExportExample();
      console.log('\n' + '='.repeat(50) + '\n');
      
      await this.fullWorkflowExample();
      
      console.log('\n✅ All examples completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Example execution failed:', error);
      throw error;
    }
  }
}