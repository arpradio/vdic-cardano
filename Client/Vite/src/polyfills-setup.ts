import { Buffer } from 'buffer';

// Simple process polyfill for browser
const processPolyfill = {
  env: {},
  browser: true,
  version: '18.0.0',
  versions: { node: '18.0.0' },
  platform: 'browser',
  nextTick: (callback: () => void) => setTimeout(callback, 0)
};

// Simple EventEmitter polyfill for browser
class EventEmitterPolyfill {
  private _events = new Map<string, Set<Function>>();

  addListener(event: string, listener: Function): this { 
    return this.on(event, listener); 
  }
  
  on(event: string, listener: Function): this {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event)!.add(listener);
    return this;
  }

  once(event: string, listener: Function): this {
    const onceWrapper = (...args: any[]) => {
      this.removeListener(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.on(event, onceWrapper);
  }

  removeListener(event: string, listener: Function): this {
    const listeners = this._events.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }

  off(event: string, listener: Function): this { 
    return this.removeListener(event, listener); 
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this._events.get(event);
    if (listeners) {
      listeners.forEach(listener => listener.apply(this, args));
      return true;
    }
    return false;
  }

  listenerCount(event: string): number {
    return this._events.get(event)?.size || 0;
  }

  listeners(event: string): Function[] {
    return Array.from(this._events.get(event) || []);
  }
}

// Set up global polyfills
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).process = processPolyfill;
  (globalThis as any).global = globalThis;
}

if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = processPolyfill;
  (window as any).global = window;
}

export { Buffer, processPolyfill as process, EventEmitterPolyfill as EventEmitter };