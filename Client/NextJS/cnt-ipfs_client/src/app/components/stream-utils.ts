export class StreamUtils {
  static createReadableStream(data: Uint8Array): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });
  }

  static async *streamToAsyncIterable(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  static async *chunkedAsyncIterable(data: Uint8Array, chunkSize: number = 64 * 1024): AsyncIterable<Uint8Array> {
    let offset = 0;
    while (offset < data.length) {
      const end = Math.min(offset + chunkSize, data.length);
      yield data.slice(offset, end);
      offset = end;
    }
  }

  static async collectAsyncIterable(iterable: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    for await (const chunk of iterable) {
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  static async streamFromFile(file: File): Promise<ReadableStream<Uint8Array>> {
    if (file.stream && typeof file.stream === 'function') {
      return file.stream();
    }

    const buffer = await file.arrayBuffer();
    return this.createReadableStream(new Uint8Array(buffer));
  }

  static async *progressTrackingIterable<T>(
    iterable: AsyncIterable<T>,
    onProgress: (processed: number, total?: number) => void,
    total?: number
  ): AsyncIterable<T> {
    let processed = 0;
    for await (const item of iterable) {
      yield item;
      processed++;
      onProgress(processed, total);
    }
  }

  static createTransformStream<T, U>(
    transformer: (chunk: T) => U | Promise<U>
  ): TransformStream<T, U> {
    return new TransformStream({
      async transform(chunk, controller) {
        const transformed = await transformer(chunk);
        controller.enqueue(transformed);
      }
    });
  }

  static async pipeToWritableStream<T>(
    iterable: AsyncIterable<T>,
    writableStream: WritableStream<T>
  ): Promise<void> {
    const writer = writableStream.getWriter();
    try {
      for await (const chunk of iterable) {
        await writer.write(chunk);
      }
    } finally {
      await writer.close();
    }
  }

  static mergeAsyncIterables<T>(...iterables: AsyncIterable<T>[]): AsyncIterable<T> {
    return {
      async *[Symbol.asyncIterator]() {
        for (const iterable of iterables) {
          yield* iterable;
        }
      }
    };
  }

  static takeAsyncIterable<T>(iterable: AsyncIterable<T>, count: number): AsyncIterable<T> {
    return {
      async *[Symbol.asyncIterator]() {
        let taken = 0;
        for await (const item of iterable) {
          if (taken >= count) break;
          yield item;
          taken++;
        }
      }
    };
  }

  static filterAsyncIterable<T>(
    iterable: AsyncIterable<T>,
    predicate: (item: T) => boolean | Promise<boolean>
  ): AsyncIterable<T> {
    return {
      async *[Symbol.asyncIterator]() {
        for await (const item of iterable) {
          if (await predicate(item)) {
            yield item;
          }
        }
      }
    };
  }

  static mapAsyncIterable<T, U>(
    iterable: AsyncIterable<T>,
    mapper: (item: T) => U | Promise<U>
  ): AsyncIterable<U> {
    return {
      async *[Symbol.asyncIterator]() {
        for await (const item of iterable) {
          yield await mapper(item);
        }
      }
    };
  }

  static async reduceAsyncIterable<T, U>(
    iterable: AsyncIterable<T>,
    reducer: (acc: U, current: T) => U | Promise<U>,
    initialValue: U
  ): Promise<U> {
    let accumulator = initialValue;
    for await (const item of iterable) {
      accumulator = await reducer(accumulator, item);
    }
    return accumulator;
  }

  static bufferAsyncIterable<T>(
    iterable: AsyncIterable<T>,
    bufferSize: number
  ): AsyncIterable<T[]> {
    return {
      async *[Symbol.asyncIterator]() {
        let buffer: T[] = [];
        for await (const item of iterable) {
          buffer.push(item);
          if (buffer.length >= bufferSize) {
            yield buffer;
            buffer = [];
          }
        }
        if (buffer.length > 0) {
          yield buffer;
        }
      }
    };
  }

  static debounceAsyncIterable<T>(
    iterable: AsyncIterable<T>,
    delay: number
  ): AsyncIterable<T> {
    return {
      async *[Symbol.asyncIterator]() {
        let timeoutId: NodeJS.Timeout | null = null;
        let lastItem: T | undefined;
        let resolve: ((value: T | undefined) => void) | null = null;

        const emitItem = () => {
          if (resolve && lastItem !== undefined) {
            resolve(lastItem);
            resolve = null;
            lastItem = undefined;
          }
        };

        for await (const item of iterable) {
          lastItem = item;
          
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          timeoutId = setTimeout(emitItem, delay);
          
          if (!resolve) {
            const promise = new Promise<T | undefined>((res) => {
              resolve = res;
            });
            const result = await promise;
            if (result !== undefined) {
              yield result;
            }
          }
        }

        if (timeoutId) {
          clearTimeout(timeoutId);
          emitItem();
        }
      }
    };
  }
}