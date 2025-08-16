// Global type declarations for browser IPFS client

declare module 'process/browser' {
  interface Process {
    env: Record<string, string | undefined>;
    browser: boolean;
    version: string;
    versions: Record<string, string>;
    platform: string;
    nextTick: (callback: () => void) => void;
  }
  const process: Process;
  export = process;
}

declare module 'events' {
  class EventEmitter {
    addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    emit(event: string | symbol, ...args: any[]): boolean;
    listenerCount(event: string | symbol): number;
    listeners(event: string | symbol): Function[];
    rawListeners(event: string | symbol): Function[];
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
    eventNames(): (string | symbol)[];
  }
  export = EventEmitter;
}

declare module 'stream-browserify' {
  export class Readable {
    constructor(options?: any);
    read(size?: number): any;
    setEncoding(encoding: string): this;
    pause(): this;
    resume(): this;
    pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean }): T;
    unpipe(destination?: NodeJS.WritableStream): this;
    unshift(chunk: any): void;
    wrap(oldStream: NodeJS.ReadableStream): this;
    push(chunk: any, encoding?: string): boolean;
    destroy(error?: Error): void;
  }
  
  export class Writable {
    constructor(options?: any);
    write(chunk: any, encoding?: string, callback?: Function): boolean;
    end(chunk?: any, encoding?: string, callback?: Function): void;
    destroy(error?: Error): void;
  }
  
  export class Transform extends Readable {
    constructor(options?: any);
    _transform(chunk: any, encoding: string, callback: Function): void;
    _flush(callback: Function): void;
  }
}

declare module 'util' {
  export function inherits(constructor: any, superConstructor: any): void;
  export function isArray(object: any): object is any[];
  export function isRegExp(object: any): object is RegExp;
  export function isDate(object: any): object is Date;
  export function isError(object: any): object is Error;
  export function format(f: any, ...args: any[]): string;
  export function inspect(object: any, options?: any): string;
  export function deprecate<T extends Function>(fn: T, message: string): T;
  export function debuglog(section: string): (message: string, ...args: any[]) => void;
}

// Global buffer type for browser
declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: any;
    global: typeof globalThis;
  }
  
  interface GlobalThis {
    Buffer: typeof Buffer;
    process: any;
    global: typeof globalThis;
  }
  
  const Buffer: {
    new (size: number): Buffer;
    new (array: Uint8Array): Buffer;
    new (arrayBuffer: ArrayBuffer): Buffer;
    new (array: readonly any[]): Buffer;
    new (str: string, encoding?: BufferEncoding): Buffer;
    alloc(size: number, fill?: string | Buffer | number, encoding?: BufferEncoding): Buffer;
    allocUnsafe(size: number): Buffer;
    allocUnsafeSlow(size: number): Buffer;
    byteLength(string: string | NodeJS.ArrayBufferView | ArrayBuffer | SharedArrayBuffer, encoding?: BufferEncoding): number;
    compare(buf1: Uint8Array, buf2: Uint8Array): number;
    concat(list: readonly Uint8Array[], totalLength?: number): Buffer;
    from(arrayBuffer: ArrayBuffer, byteOffset?: number, length?: number): Buffer;
    from(data: Uint8Array | readonly number[]): Buffer;
    from(data: WithImplicitCoercion<Uint8Array | readonly number[] | string>): Buffer;
    from(str: WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: 'string'): string }, encoding?: BufferEncoding): Buffer;
    isBuffer(obj: any): obj is Buffer;
    isEncoding(encoding: string): encoding is BufferEncoding;
  };
  
  interface Buffer extends Uint8Array {
    write(string: string, encoding?: BufferEncoding): number;
    write(string: string, offset: number, encoding?: BufferEncoding): number;
    write(string: string, offset: number, length: number, encoding?: BufferEncoding): number;
    toString(encoding?: BufferEncoding, start?: number, end?: number): string;
    toJSON(): { type: 'Buffer'; data: number[] };
    equals(otherBuffer: Uint8Array): boolean;
    compare(target: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
    copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): Buffer;
    readUIntLE(offset: number, byteLength: number): number;
    readUIntBE(offset: number, byteLength: number): number;
    readIntLE(offset: number, byteLength: number): number;
    readIntBE(offset: number, byteLength: number): number;
    readUInt8(offset: number): number;
    readUInt16LE(offset: number): number;
    readUInt16BE(offset: number): number;
    readUInt32LE(offset: number): number;
    readUInt32BE(offset: number): number;
    readInt8(offset: number): number;
    readInt16LE(offset: number): number;
    readInt16BE(offset: number): number;
    readInt32LE(offset: number): number;
    readInt32BE(offset: number): number;
    readFloatLE(offset: number): number;
    readFloatBE(offset: number): number;
    readDoubleLE(offset: number): number;
    readDoubleBE(offset: number): number;
    reverse(): this;
    swap16(): Buffer;
    swap32(): Buffer;
    swap64(): Buffer;
    writeUIntLE(value: number, offset: number, byteLength: number): number;
    writeUIntBE(value: number, offset: number, byteLength: number): number;
    writeIntLE(value: number, offset: number, byteLength: number): number;
    writeIntBE(value: number, offset: number, byteLength: number): number;
    writeUInt8(value: number, offset: number): number;
    writeUInt16LE(value: number, offset: number): number;
    writeUInt16BE(value: number, offset: number): number;
    writeUInt32LE(value: number, offset: number): number;
    writeUInt32BE(value: number, offset: number): number;
    writeInt8(value: number, offset: number): number;
    writeInt16LE(value: number, offset: number): number;
    writeInt16BE(value: number, offset: number): number;
    writeInt32LE(value: number, offset: number): number;
    writeInt32BE(value: number, offset: number): number;
    writeFloatLE(value: number, offset: number): number;
    writeFloatBE(value: number, offset: number): number;
    writeDoubleLE(value: number, offset: number): number;
    writeDoubleBE(value: number, offset: number): number;
    fill(value: string | Uint8Array | number, offset?: number, end?: number, encoding?: BufferEncoding): this;
    indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: BufferEncoding): number;
    lastIndexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: BufferEncoding): number;
    includes(value: string | number | Buffer, byteOffset?: number, encoding?: BufferEncoding): boolean;
  }
}

// Common types
type BufferEncoding = 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex';

type WithImplicitCoercion<T> = T | { valueOf(): T };