import { PinningService, DatastoreItem } from './interfaces';

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
  error?: string;
}

export class PinningManager {
  static async pinFile(
    item: DatastoreItem,
    service: PinningService,
    onProgress?: (message: string) => void
  ): Promise<PinStatus> {
    try {
      onProgress?.(`Pinning ${item.name} to ${service.name}...`);

      const pinRequest: PinRequest = {
        cid: item.cid,
        name: item.name,
        meta: {
          size: item.size,
          type: item.type,
          contentType: item.contentType,
          encrypted: item.encrypted,
          sharded: item.sharded,
          timestamp: item.timestamp
        }
      };

      const response = await this.sendPinRequest(service, pinRequest);

      if (response.success) {
        onProgress?.(`Successfully pinned to ${service.name}`);
        return { success: true, status: 'pinned' };
      } else {
        onProgress?.(`Failed to pin to ${service.name}: ${response.error}`);
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.(`Error pinning to ${service.name}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private static async sendPinRequest(
    service: PinningService,
    pinRequest: PinRequest
  ): Promise<{ success: boolean; error?: string; response?: PinResponse }> {
    try {
      const url = this.buildPinUrl(service);
      const headers = this.buildHeaders(service);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(pinRequest),
      });

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
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  static async testService(service: PinningService): Promise<{ verified: boolean; error?: string }> {
    try {
      const url = this.buildTestUrl(service);
      const headers = this.buildHeaders(service);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        return { verified: true };
      } else {
        return { 
          verified: false, 
          error: `${response.status} ${response.statusText}` 
        };
      }
    } catch (error) {
      return { 
        verified: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  static async listPins(service: PinningService): Promise<{ success: boolean; pins?: any[]; error?: string }> {
    try {
      const url = this.buildListUrl(service);
      const headers = this.buildHeaders(service);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, pins: data.results || [] };
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          error: `${response.status} ${response.statusText}: ${errorText}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  static async unpinFile(
    cid: string,
    service: PinningService
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = this.buildUnpinUrl(service, cid);
      const headers = this.buildHeaders(service);

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

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
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  static async getPinStatus(
    requestId: string,
    service: PinningService
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const url = this.buildStatusUrl(service, requestId);
      const headers = this.buildHeaders(service);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, status: data.status };
      } else {
        const errorText = await response.text();
        return { 
          success: false, 
          error: `${response.status} ${response.statusText}: ${errorText}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  private static buildPinUrl(service: PinningService): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    return `${baseUrl}/pins`;
  }

  private static buildTestUrl(service: PinningService): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    return `${baseUrl}/pins?limit=1`;
  }

  private static buildListUrl(service: PinningService): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    return `${baseUrl}/pins`;
  }

  private static buildUnpinUrl(service: PinningService, cid: string): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    return `${baseUrl}/pins/${cid}`;
  }

  private static buildStatusUrl(service: PinningService, requestId: string): string {
    const baseUrl = service.endpoint.replace(/\/$/, '');
    return `${baseUrl}/pins/${requestId}`;
  }

  private static buildHeaders(service: PinningService): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${service.accessToken}`,
    };
  }

  static createDefaultServices(): PinningService[] {
    return [
      {
        id: 'web3-storage',
        name: 'Web3.Storage',
        endpoint: 'https://api.web3.storage',
        accessToken: '',
        type: 'ipfs-pinning-service',
        verified: false,
        enabled: false,
      },
      {
        id: 'pinata',
        name: 'Pinata',
        endpoint: 'https://api.pinata.cloud/pinning',
        accessToken: '',
        type: 'custom',
        verified: false,
        enabled: false,
      },
      {
        id: 'nft-storage',
        name: 'NFT.Storage',
        endpoint: 'https://api.nft.storage',
        accessToken: '',
        type: 'ipfs-pinning-service',
        verified: false,
        enabled: false,
      },
      {
        id: 'lighthouse',
        name: 'Lighthouse',
        endpoint: 'https://api.lighthouse.storage',
        accessToken: '',
        type: 'custom',
        verified: false,
        enabled: false,
      },
    ];
  }

  static validateService(service: Partial<PinningService>): string[] {
    const errors: string[] = [];

    if (!service.name?.trim()) {
      errors.push('Service name is required');
    }
    if (!service.endpoint?.trim()) {
      errors.push('API endpoint is required');
    }
    if (!service.accessToken?.trim()) {
      errors.push('Access token is required');
    }
    if (!service.type) {
      errors.push('Service type is required');
    }

    if (service.endpoint && !this.isValidUrl(service.endpoint)) {
      errors.push('Invalid API endpoint URL');
    }

    return errors;
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static async pinToMultipleServices(
    item: DatastoreItem,
    services: PinningService[],
    onProgress?: (message: string) => void
  ): Promise<Record<string, PinStatus>> {
    const results: Record<string, PinStatus> = {};
    const enabledServices = services.filter(s => s.enabled && s.verified);

    onProgress?.(`Pinning to ${enabledServices.length} services...`);

    const pinPromises = enabledServices.map(async (service) => {
      const result = await this.pinFile(item, service, onProgress);
      results[service.id] = result;
      return result;
    });

    await Promise.allSettled(pinPromises);

    const successCount = Object.values(results).filter(r => r.success).length;
    onProgress?.(`Pinning complete: ${successCount}/${enabledServices.length} services successful`);

    return results;
  }
}