import type http from 'node:http';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { DidwwClientError } from '../errors.js';
import { contentLength, pauseReadTimer, resumeReadTimer, TimeoutError, timeoutOf } from './transport.js';

export const MAX_ERROR_BODY = 1 << 20;
export const DEFAULT_ERROR_BODY_TIMEOUT = 60_000;

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);

/** A body could not be read in full; `cause` is the failure, `incomplete` tells whether the body was cut short. */
export class BodyReadError extends Error {
  readonly incomplete: boolean;

  constructor(cause: unknown, incomplete: boolean) {
    super(incomplete ? 'the body was cut short' : 'the body could not be read', { cause });
    this.name = 'BodyReadError';
    this.incomplete = incomplete;
  }
}

function readFailure(res: http.IncomingMessage, error: unknown): BodyReadError {
  const timedOut = timeoutOf(res);
  if (timedOut) return new BodyReadError(timedOut, false);
  if (error instanceof TimeoutError) return new BodyReadError(error, false);
  return new BodyReadError(error, !res.complete);
}

export interface ReadOptions {
  /** At most this many bytes are kept; the rest of the body is dropped. */
  limit?: number;
  /** The whole read must end within this many milliseconds. */
  deadlineMs?: number | null;
  /** Fail on a cut or late body instead of returning what was read. */
  strict: boolean;
}

/** Reads the raw body of `res`. With `strict`, a body cut short (also against Content-Length) or late raises `BodyReadError`. */
export function readAll(res: http.IncomingMessage, options: ReadOptions): Promise<Buffer> {
  const limit = options.limit ?? Infinity;
  const deadlineMs = options.deadlineMs ?? null;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let count = 0;
    let settled = false;
    const deadline =
      deadlineMs !== null ? setTimeout(() => finish(new TimeoutError('read', deadlineMs)), deadlineMs) : null;

    function finish(error?: unknown) {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      const body = Buffer.concat(chunks, count);
      if (error === undefined) {
        const expected = contentLength(res);
        if (options.strict && expected !== null && count < Math.min(expected, limit)) {
          reject(new BodyReadError(new Error('the body ended before its Content-Length'), true));
        } else {
          resolve(body);
        }
        return;
      }
      res.destroy();
      if (options.strict) reject(readFailure(res, error));
      else resolve(body);
    }

    res.on('data', (chunk: Buffer) => {
      if (settled) return;
      resumeReadTimer(res);
      const take = Math.min(chunk.length, limit - count);
      chunks.push(take === chunk.length ? chunk : chunk.subarray(0, take));
      count += take;
      if (count >= limit) {
        finish();
        res.destroy();
      }
    });
    res.on('end', () => finish());
    res.on('error', (e) => finish(e));
    res.on('close', () => finish(res.complete ? undefined : new Error('aborted')));
  });
}

/** Reads an error body bounded in size and time and undoes a gzip or deflate content coding. Never throws. */
export async function readErrorBody(res: http.IncomingMessage, timeoutMs: number | null): Promise<Buffer> {
  const body = await readAll(res, {
    limit: MAX_ERROR_BODY,
    deadlineMs: timeoutMs ?? DEFAULT_ERROR_BODY_TIMEOUT,
    strict: false,
  });
  const coding = contentCoding(res);
  if (coding === 'identity') return body;
  const options = { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: MAX_ERROR_BODY };
  try {
    if (coding === 'gzip' || coding === 'x-gzip') return await gunzip(body, options);
    if (coding === 'deflate') return await inflate(body, options).catch(() => inflateRaw(body, options));
  } catch {
    // An undecodable error body is reported as an empty one.
  }
  return Buffer.alloc(0);
}

export function contentCoding(res: http.IncomingMessage): string {
  const value = res.headers['content-encoding'];
  const coding = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return coding === '' ? 'identity' : coding;
}

/** Undoes the content coding of a success body; codings other than gzip and deflate are refused. */
export async function decodeBody(body: Buffer, coding: string): Promise<Buffer> {
  if (coding === 'identity') return body;
  if (coding === 'gzip' || coding === 'x-gzip') return gunzip(body);
  if (coding === 'deflate') return inflate(body).catch(() => inflateRaw(body));
  throw new DidwwClientError(`unsupported Content-Encoding ${JSON.stringify(coding)}`);
}

/**
 * The raw chunks of `res`, counted into `counter`. The read timeout is paused
 * while the consumer holds a chunk. Read failures raise `BodyReadError`.
 */
export async function* rawChunks(res: http.IncomingMessage, counter: { count: number }): AsyncGenerator<Buffer> {
  let iterator: AsyncIterator<Buffer>;
  try {
    iterator = res[Symbol.asyncIterator]();
  } catch (e) {
    throw readFailure(res, e);
  }
  try {
    for (;;) {
      let next: IteratorResult<Buffer>;
      try {
        next = await iterator.next();
      } catch (e) {
        throw readFailure(res, e);
      }
      if (next.done) return;
      counter.count += next.value.length;
      pauseReadTimer(res);
      yield next.value;
      resumeReadTimer(res);
    }
  } finally {
    await iterator.return?.();
  }
}

type CallerStream = NodeJS.WritableStream & { destroyed?: boolean; writableEnded?: boolean; errored?: unknown };

/** Writes `chunk` to `dest` and waits until it was taken; a destroyed or ended stream is refused with its own error, if any. */
export function writeChunk(dest: NodeJS.WritableStream, chunk: Buffer): Promise<void> {
  const stream = dest as CallerStream;
  if (stream.destroyed || stream.writableEnded) {
    return Promise.reject(stream.errored ?? new DidwwClientError('the destination stream is closed'));
  }
  return new Promise((resolve, reject) => {
    dest.write(chunk, (error?: Error | null) => (error ? reject(error) : resolve()));
  });
}

/**
 * Runs `transfer` with a writer into the caller's stream `dest`, which is left
 * open; a stream already closed is refused before `transfer` runs. The first error the stream emits during the call rejects it unchanged,
 * whatever the transfer gave. A failing stream also emits 'error' after the
 * failed write; without a listener that would crash the process, so one is
 * kept until then and removed on every other path.
 */
export async function writeIntoStream<T>(
  dest: NodeJS.WritableStream,
  transfer: (write: (chunk: Buffer) => Promise<void>) => Promise<T>,
): Promise<T> {
  const stream = dest as CallerStream;
  // Refused before the transfer, so that no request is sent for it.
  if (stream.destroyed || stream.writableEnded) {
    throw stream.errored ?? new DidwwClientError('the destination stream is closed');
  }
  const listens = typeof stream.on === 'function';
  let failed = false;
  let destError: unknown;
  let settled = false;
  let writeFailed = false;
  const release = () => stream.removeListener('error', onError);
  function onError(error: unknown) {
    if (!failed) {
      failed = true;
      destError = error;
    }
    if (settled) release();
  }
  const write = async (chunk: Buffer) => {
    if (failed) throw destError;
    try {
      await writeChunk(dest, chunk);
    } catch (e) {
      writeFailed = true;
      throw failed ? destError : e;
    }
  };
  if (listens) stream.on('error', onError);
  try {
    const result = await transfer(write);
    if (failed) throw destError;
    return result;
  } catch (e) {
    throw failed ? destError : e;
  } finally {
    settled = true;
    // An 'error' is still due when a write failed on a stream that is errored but has not emitted it yet.
    const due = writeFailed && !failed && stream.errored !== undefined && stream.errored !== null;
    if (listens && !due) release();
  }
}
