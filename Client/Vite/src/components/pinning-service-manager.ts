import { PinningService, FileMetadata } from './types';

export interface PinRequest {
  cid: string;
  name: string;
  meta?: Record<string, any>;
}

export interface PinResponse {
  requestid: string;
  status: 'queued' | 'pinning' | 'pinned' | 'failed';
  created: string;
  pin: {
    cid: string;
    name: string;
    meta?: Record<string, any>;
  };
}

export interface PinStatus {
  success: boolean;
  status?: string;
  requestId?: string;
  error?: string;
}

export interface PinningProgress {
  serviceId: string;
  serviceName: string;
  status: 'pending' | 'pinning' | 'pinned' | 'failed';
  error?: string;
}

export class PinningServiceManager {
  private static readonly API_TIMEOUT = 30000;

  static async testService(service: PinningService): Promise<{ verified: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const headers = this.buildHeaders(service);
      const url = this.buildTestUrl(service);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { verified: true };
      } else {
        const errorText = await response.text();
        return { 
          verified: false, 
          error: `${response.status} ${response.statusText}: ${errorText}` 
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { verified: false, error: 'Request timeout' };
      }
      return { 
        verified: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  static async pinFile(
    file: FileMetadata,
    service: PinningService,
    onProgress?: (progress: PinningProgress) => void
  ): Promise<PinStatus> {
    try {
      onProgress?.({
        serviceId: service.id,
        serviceName: service.name,
        status: 'pending'
      });

      const pinRequest: PinRequest = {
        cid: file.cid,
        name: file.name,
        meta: {
          size: file.size,
          mimeType: file.mimeType,
          contentType: file.contentType,
          encrypted: file.encrypted,
          sharded: file.sharded,
          uploadedAt: file.uploadedAt,
          tags: file.tags
        }
      };

      onProgress?.({
        serviceId: service.id,
        serviceName: service.name,
        status: 'pinning'
      });

      const result = await this.sendPinRequest(service, pinRequest);

      if (result.success && result.response) {
        onProgress?.({
          serviceId: service.id,
          serviceName: service.name,
          status: 'pinned'
        });

        return {
          success: true,
          status: result.response.status,
          requestId: result.response.requestid
        };
      } else {
        onProgress?.({
          serviceId: service.id,
          serviceName: service.name,
          status: 'failed',
          error: result.error
        });

        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      onProgress?.({
        serviceId: service.id,
        serviceName: service.name,
        status: 'failed',
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  static async pinToMultipleServices(
    file: FileMetadata,
    services: PinningService[],
    onProgress?: (progress: PinningProgress) => void
  ): Promise<Record<string, PinStatus>> {
    const enabledServices = services.filter(s => s.enabled && s.verified);
    const results: Record<string, PinStatus> = {};

    const pinPromises = enabledServices.map(async (service) => {
      const result = await this.pinFile(file, service, onProgress);
      results[service.id] = result;
      return result;
    });

    await Promise.allSettled(pinPromises);
    return results;
  }

  static async unpinFile(
    cid: string,
    service: PinningService
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const headers = this.buildHeaders(service);
      const url = this.buildUnpinUrl(service, cid);

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true };
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          error: `${response.status} ${response.statusText}: ${errorText}` 
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  static async listPins(
    service: PinningService,
    limit: number = 100
  ): Promise<{ success: boolean; pins?: PinResponse[]; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const headers = this.buildHeaders(service);
      const url = `${this.buildListUrl(service)}?limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return { success: true, pins: data.results || data };
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          error: `${response.status} ${response.statusText}: ${errorText}` 
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  private static async sendPinRequest(
    service: PinningService,
    pinRequest: PinRequest
  ): Promise<{ success: boolean; error?: string; response?: PinResponse }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const headers = this.buildHeaders(service);
      const url = this.buildPinUrl(service);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(pinRequest),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return { success: true, response: data };
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          error: `${response.status} ${response.statusText}: ${errorText}` 
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  private static buildHeaders(service: PinningService): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (service.type === 'web3-storage') {
      headers['Authorization'] = `Bearer ${service.accessToken}`;
    } else if (service.type === 'pinata') {
      headers['pinata_api_key'] = service.accessToken;
      headers['pinata_secret_api_key'] = service.accessToken;
    } else {
      headers['Authorization'] = `Bearer ${service.accessToken}`;
    }

    return headers;
  }

  private static buildPinUrl(service: PinningService): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    
    switch (service.type) {
      case 'web3-storage':
        return `${baseUrl}/pins`;
      case 'pinata':
        return `${baseUrl}/pinning/pinJSONToIPFS`;
      case 'ipfs-pinning-service':
        return `${baseUrl}/pins`;
      default:
        return `${baseUrl}/pins`;
    }
  }

  private static buildTestUrl(service: PinningService): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    
    switch (service.type) {
      case 'web3-storage':
        return `${baseUrl}/pins?limit=1`;
      case 'pinata':
        return `${baseUrl}/data/testAuthentication`;
      case 'ipfs-pinning-service':
        return `${baseUrl}/pins?limit=1`;
      default:
        return `${baseUrl}/pins?limit=1`;
    }
  }

  private static buildListUrl(service: PinningService): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    
    switch (service.type) {
      case 'web3-storage':
        return `${baseUrl}/pins`;
      case 'pinata':
        return `${baseUrl}/data/pinList`;
      case 'ipfs-pinning-service':
        return `${baseUrl}/pins`;
      default:
        return `${baseUrl}/pins`;
    }
  }

  private static buildUnpinUrl(service: PinningService, cid: string): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    
    switch (service.type) {
      case 'web3-storage':
        return `${baseUrl}/pins/${cid}`;
      case 'pinata':
        return `${baseUrl}/pinning/unpin/${cid}`;
      case 'ipfs-pinning-service':
        return `${baseUrl}/pins/${cid}`;
      default:
        return `${baseUrl}/pins/${cid}`;
    }
  }

  static validateService(service: Partial<PinningService>): string[] {
    const errors: string[] = [];

    if (!service.name?.trim()) {
      errors.push('Service name is required');
    }

    if (!service.endpoint?.trim()) {
      errors.push('API endpoint is required');
    } else if (!this.isValidUrl(service.endpoint)) {
      errors.push('Invalid API endpoint URL');
    }

    if (!service.accessToken?.trim()) {
      errors.push('Access token is required');
    }

    if (!service.type) {
      errors.push('Service type is required');
    }

    return errors;
  }

  private static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}