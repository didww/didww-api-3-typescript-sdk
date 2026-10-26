import type zlib from 'node:zlib';

type Destroyable = { destroy?: (error?: Error) => void };

/** A web `ReadableStream` of bytes, as the body of a `fetch()` response. */
export type WebByteStream = ReadableStream<Uint8Array>;

/** Whether `input` is a web `ReadableStream` (it has `getReader`). */
export function isWebStream(input: unknown): input is WebByteStream {
  return (
    input !== null && typeof input === 'object' && typeof (input as { getReader?: unknown }).getReader === 'function'
  );
}

// Reads a web stream through a reader of its own: its return() cancels the
// stream at once, which settles a pending read, where the stream's async
// iterator would wait for that read first.
function webIterator(input: WebByteStream): AsyncIterator<Uint8Array> {
  const reader = input.getReader();
  return {
    next: () => reader.read() as Promise<IteratorResult<Uint8Array>>,
    return: async () => {
      await reader.cancel().catch(() => undefined);
      return { value: undefined, done: true };
    },
  };
}

/**
 * Writes `input` into `gunzip`, one chunk at a time, and ends it. zlib stops
 * at a zero byte after a gzip member and takes the rest as padding; from then
 * on (`gunzip` ended, or `gunzip.bytesWritten` below the bytes written) the
 * rest of `input` is still read to its end, so that a reader that counts it
 * sees all of it, but no longer written. The result therefore does not depend
 * on how the input is split into chunks or on how fast `gunzip` is read. Run
 * it alongside the reading of `gunzip`: a write waits until its output has
 * been read, or until `gunzip` ends or closes.
 *
 * An error of `input` destroys `gunzip` with it and rejects. When the reader
 * destroys `gunzip` before reading its end, the feeding stops: `input` is no
 * longer read, its iterator is returned and a destroyable `input` is
 * destroyed. A web `ReadableStream` is read through a reader and cancelled,
 * also while it is waiting for data. An abort of `signal` does the same,
 * destroys `gunzip` with the abort reason and rejects with it at once, also
 * while `input` is waiting for data.
 */
export function feedGunzip(
  input: AsyncIterable<Uint8Array> | Iterable<Uint8Array> | WebByteStream,
  gunzip: zlib.Gunzip,
  signal?: AbortSignal,
): Promise<void> {
  const iterator = isWebStream(input)
    ? webIterator(input)
    : Symbol.asyncIterator in input
      ? input[Symbol.asyncIterator]()
      : (async function* () {
          yield* input;
        })();
  let settled = false;
  const releaseInput = () => {
    if (settled) return;
    (input as Destroyable).destroy?.();
    Promise.resolve()
      .then(() => iterator.return?.())
      .catch(() => undefined);
  };
  const onClose = () => {
    if (!gunzip.readableEnded) releaseInput();
  };

  // Settles on the write callback, or on 'end' or 'close' of `gunzip`: once
  // its readable side has ended, Node 18 may never call the write callback.
  const write = (chunk: Uint8Array) =>
    new Promise<void>((resolve, reject) => {
      const settle = (error?: Error | null) => {
        gunzip.removeListener('end', settle);
        gunzip.removeListener('close', settle);
        if (error) reject(error);
        else resolve();
      };
      gunzip.once('end', settle);
      gunzip.once('close', settle);
      gunzip.write(chunk, settle);
    });

  async function feed(): Promise<void> {
    let fed = 0;
    let consuming = true;
    try {
      for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
        if (signal?.aborted) return;
        if (gunzip.destroyed && !gunzip.readableEnded) return;
        if (gunzip.readableEnded) consuming = false;
        if (!consuming) continue;
        fed += chunk.length;
        await write(chunk);
        if (gunzip.destroyed && !gunzip.readableEnded) return;
        if (gunzip.readableEnded || gunzip.bytesWritten < fed) consuming = false;
      }
    } catch (e) {
      gunzip.destroy(e as Error);
      throw e;
    }
    if (!gunzip.destroyed) gunzip.end();
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      gunzip.destroy(signal!.reason as Error);
      releaseInput();
      reject(signal!.reason);
    };
    gunzip.once('close', onClose);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    feed()
      .then(resolve, reject)
      .finally(() => {
        settled = true;
        gunzip.removeListener('close', onClose);
        signal?.removeEventListener('abort', onAbort);
      });
  });
}
