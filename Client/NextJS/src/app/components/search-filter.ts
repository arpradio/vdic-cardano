import { DatastoreItem } from './interfaces';

export interface SearchQuery {
  text?: string;
  contentType?: string[];
  mimeType?: string[];
  encrypted?: boolean;
  sharded?: boolean;
  verified?: boolean;
  sizeRange?: { min?: number; max?: number };
  dateRange?: { start?: number; end?: number };
  pinnedToServices?: string[];
  tags?: string[];
}

export interface SortOptions {
  field: keyof DatastoreItem;
  direction: 'asc' | 'desc';
}

export interface FilterResult {
  items: DatastoreItem[];
  totalCount: number;
  filteredCount: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  contentTypes: Record<string, number>;
  mimeTypes: Record<string, number>;
  sizes: { min: number; max: number; average: number };
  dates: { oldest: number; newest: number };
  encryptedCount: number;
  shardedCount: number;
  verifiedCount: number;
  pinnedCount: number;
}

export class SearchFilter {
  static search(
    items: DatastoreItem[],
    query: SearchQuery,
    sort?: SortOptions,
    limit?: number,
    offset?: number
  ): FilterResult {
    let filteredItems = this.applyFilters(items, query);
    
    if (sort) {
      filteredItems = this.applySorting(filteredItems, sort);
    }

    const totalFiltered = filteredItems.length;
    
    if (offset !== undefined && limit !== undefined) {
      filteredItems = filteredItems.slice(offset, offset + limit);
    } else if (limit !== undefined) {
      filteredItems = filteredItems.slice(0, limit);
    }

    return {
      items: filteredItems,
      totalCount: items.length,
      filteredCount: totalFiltered,
      facets: this.generateFacets(items)
    };
  }

  private static applyFilters(items: DatastoreItem[], query: SearchQuery): DatastoreItem[] {
    return items.filter(item => {
      if (query.text && !this.matchesTextQuery(item, query.text)) {
        return false;
      }

      if (query.contentType && query.contentType.length > 0) {
        if (!query.contentType.includes(item.contentType)) {
          return false;
        }
      }

      if (query.mimeType && query.mimeType.length > 0) {
        if (!query.mimeType.includes(item.mimeType)) {
          return false;
        }
      }

      if (query.encrypted !== undefined && item.encrypted !== query.encrypted) {
        return false;
      }

      if (query.sharded !== undefined && item.sharded !== query.sharded) {
        return false;
      }

      if (query.verified !== undefined && item.verified !== query.verified) {
        return false;
      }

      if (query.sizeRange) {
        if (query.sizeRange.min !== undefined && item.size < query.sizeRange.min) {
          return false;
        }
        if (query.sizeRange.max !== undefined && item.size > query.sizeRange.max) {
          return false;
        }
      }

      if (query.dateRange) {
        if (query.dateRange.start !== undefined && item.timestamp < query.dateRange.start) {
          return false;
        }
        if (query.dateRange.end !== undefined && item.timestamp > query.dateRange.end) {
          return false;
        }
      }

      if (query.pinnedToServices && query.pinnedToServices.length > 0) {
        const hasRequiredPin = query.pinnedToServices.some(serviceId => 
          item.pinned.includes(serviceId)
        );
        if (!hasRequiredPin) {
          return false;
        }
      }

      if (query.tags && query.tags.length > 0) {
        const itemTags = this.extractTags(item);
        const hasRequiredTag = query.tags.some(tag => 
          itemTags.includes(tag.toLowerCase())
        );
        if (!hasRequiredTag) {
          return false;
        }
      }

      return true;
    });
  }

  private static matchesTextQuery(item: DatastoreItem, query: string): boolean {
    const searchTerm = query.toLowerCase();
    
    if (item.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    if (item.cid.toLowerCase().includes(searchTerm)) {
      return true;
    }

    if (item.type.toLowerCase().includes(searchTerm)) {
      return true;
    }

    if (item.mimeType.toLowerCase().includes(searchTerm)) {
      return true;
    }

    if (item.metadata) {
      const metadataString = JSON.stringify(item.metadata).toLowerCase();
      if (metadataString.includes(searchTerm)) {
        return true;
      }
    }

    return false;
  }

  private static extractTags(item: DatastoreItem): string[] {
    const tags: string[] = [];
    
    if (item.encrypted) tags.push('encrypted');
    if (item.sharded) tags.push('sharded');
    if (item.verified) tags.push('verified');
    if (item.pinned.length > 0) tags.push('pinned');
    
    tags.push(item.contentType);
    tags.push(item.mimeType.split('/')[0]);
    
    const extension = this.getFileExtension(item.name);
    if (extension) tags.push(extension);
    
    if (item.metadata?.tags && Array.isArray(item.metadata.tags)) {
      tags.push(...item.metadata.tags.map((tag: string) => tag.toLowerCase()));
    }

    return tags;
  }

  private static getFileExtension(filename: string): string | null {
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  private static applySorting(items: DatastoreItem[], sort: SortOptions): DatastoreItem[] {
    return [...items].sort((a, b) => {
      const aValue = a[sort.field];
      const bValue = b[sort.field];
      
      let comparison = 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        comparison = Number(aValue) - Number(bValue);
      } else if (Array.isArray(aValue) && Array.isArray(bValue)) {
        comparison = aValue.length - bValue.length;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }

  private static generateFacets(items: DatastoreItem[]): SearchFacets {
    const facets: SearchFacets = {
      contentTypes: {},
      mimeTypes: {},
      sizes: { min: 0, max: 0, average: 0 },
      dates: { oldest: 0, newest: 0 },
      encryptedCount: 0,
      shardedCount: 0,
      verifiedCount: 0,
      pinnedCount: 0
    };

    if (items.length === 0) {
      return facets;
    }

    let totalSize = 0;
    let minSize = Infinity;
    let maxSize = 0;
    let oldestDate = Infinity;
    let newestDate = 0;

    items.forEach(item => {
      facets.contentTypes[item.contentType] = (facets.contentTypes[item.contentType] || 0) + 1;
      facets.mimeTypes[item.mimeType] = (facets.mimeTypes[item.mimeType] || 0) + 1;
      
      totalSize += item.size;
      minSize = Math.min(minSize, item.size);
      maxSize = Math.max(maxSize, item.size);
      
      oldestDate = Math.min(oldestDate, item.timestamp);
      newestDate = Math.max(newestDate, item.timestamp);
      
      if (item.encrypted) facets.encryptedCount++;
      if (item.sharded) facets.shardedCount++;
      if (item.verified) facets.verifiedCount++;
      if (item.pinned.length > 0) facets.pinnedCount++;
    });

    facets.sizes = {
      min: minSize === Infinity ? 0 : minSize,
      max: maxSize,
      average: Math.round(totalSize / items.length)
    };

    facets.dates = {
      oldest: oldestDate === Infinity ? 0 : oldestDate,
      newest: newestDate
    };

    return facets;
  }

  static suggestSearchTerms(items: DatastoreItem[], query: string): string[] {
    const suggestions = new Set<string>();
    const searchTerm = query.toLowerCase();

    items.forEach(item => {
      const terms = [
        item.name,
        item.contentType,
        item.mimeType,
        ...this.extractTags(item)
      ];

      terms.forEach(term => {
        if (term.toLowerCase().includes(searchTerm) && term.toLowerCase() !== searchTerm) {
          suggestions.add(term);
        }
      });
    });

    return Array.from(suggestions).slice(0, 10);
  }

  static buildQueryFromFacets(facets: Record<string, any>): SearchQuery {
    const query: SearchQuery = {};

    if (facets.contentTypes) {
      query.contentType = Object.keys(facets.contentTypes).filter(
        key => facets.contentTypes[key]
      );
    }

    if (facets.mimeTypes) {
      query.mimeType = Object.keys(facets.mimeTypes).filter(
        key => facets.mimeTypes[key]
      );
    }

    if (facets.encrypted !== undefined) {
      query.encrypted = facets.encrypted;
    }

    if (facets.sharded !== undefined) {
      query.sharded = facets.sharded;
    }

    if (facets.verified !== undefined) {
      query.verified = facets.verified;
    }

    if (facets.sizeMin !== undefined || facets.sizeMax !== undefined) {
      query.sizeRange = {
        min: facets.sizeMin,
        max: facets.sizeMax
      };
    }

    if (facets.dateStart !== undefined || facets.dateEnd !== undefined) {
      query.dateRange = {
        start: facets.dateStart,
        end: facets.dateEnd
      };
    }

    return query;
  }

  static groupItemsByField(
    items: DatastoreItem[],
    field: keyof DatastoreItem
  ): Record<string, DatastoreItem[]> {
    const groups: Record<string, DatastoreItem[]> = {};

    items.forEach(item => {
      const value = String(item[field]);
      if (!groups[value]) {
        groups[value] = [];
      }
      groups[value].push(item);
    });

    return groups;
  }

  static findSimilarItems(
    targetItem: DatastoreItem,
    allItems: DatastoreItem[],
    threshold: number = 0.7
  ): DatastoreItem[] {
    return allItems
      .filter(item => item.cid !== targetItem.cid)
      .map(item => ({
        item,
        similarity: this.calculateSimilarity(targetItem, item)
      }))
      .filter(({ similarity }) => similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .map(({ item }) => item);
  }

  private static calculateSimilarity(item1: DatastoreItem, item2: DatastoreItem): number {
    let score = 0;
    let factors = 0;

    if (item1.contentType === item2.contentType) {
      score += 0.3;
    }
    factors++;

    if (item1.mimeType === item2.mimeType) {
      score += 0.2;
    }
    factors++;

    const sizeDiff = Math.abs(item1.size - item2.size) / Math.max(item1.size, item2.size);
    score += (1 - sizeDiff) * 0.2;
    factors++;

    if (item1.encrypted === item2.encrypted) {
      score += 0.1;
    }
    factors++;

    if (item1.sharded === item2.sharded) {
      score += 0.1;
    }
    factors++;

    const nameWords1 = item1.name.toLowerCase().split(/\W+/);
    const nameWords2 = item2.name.toLowerCase().split(/\W+/);
    const commonWords = nameWords1.filter(word => nameWords2.includes(word));
    const nameSimilarity = commonWords.length / Math.max(nameWords1.length, nameWords2.length);
    score += nameSimilarity * 0.1;
    factors++;

    return score / factors;
  }

  static createSavedSearch(
    name: string,
    query: SearchQuery,
    sort?: SortOptions
  ): { id: string; name: string; query: SearchQuery; sort?: SortOptions; created: number } {
    return {
      id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      query,
      sort,
      created: Date.now()
    };
  }

  static exportSearchResults(
    items: DatastoreItem[],
    format: 'json' | 'csv' | 'txt' = 'json'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(items, null, 2);
      
      case 'csv':
        const headers = 'CID,Name,Size,Type,Content Type,MIME Type,Encrypted,Sharded,Verified,Timestamp\n';
        const rows = items.map(item => 
          `${item.cid},${JSON.stringify(item.name)},${item.size},${item.type},${item.contentType},${item.mimeType},${item.encrypted},${item.sharded},${item.verified},${item.timestamp}`
        ).join('\n');
        return headers + rows;
      
      case 'txt':
        return items.map(item => 
          `${item.name} (${item.cid})\n  Size: ${item.size} bytes\n  Type: ${item.contentType}/${item.mimeType}\n  Features: ${[
            item.encrypted && 'encrypted',
            item.sharded && 'sharded',
            item.verified && 'verified'
          ].filter(Boolean).join(', ') || 'none'}\n`
        ).join('\n');
      
      default:
        return JSON.stringify(items, null, 2);
    }
  }
}