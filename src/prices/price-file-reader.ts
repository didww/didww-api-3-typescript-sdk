import { createReadStream } from 'node:fs';
import zlib from 'node:zlib';
import { DidwwClientError } from '../errors.js';
import { feedGunzip, isWebStream } from '../gzip.js';
import { CsvParser, type CsvRecord } from './csv.js';

/** A row of a price file, keyed by the header line of the file. */
export type PriceFileRow = Readonly<Record<string, string>>;

/**
 * A file path, the bytes of a file, a readable stream, a web `ReadableStream`
 * (as the body of a `fetch()` response) or an async iterable of bytes.
 */
export type PriceFileSource =
  | string
  | Uint8Array
  | NodeJS.ReadableStream
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

function checkSource(source: unknown): void {
  const valid =
    typeof source === 'string' ||
    source instanceof Uint8Array ||
    isWebStream(source) ||
    (source !== null &&
      typeof source === 'object' &&
      typeof (source as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function');
  if (!valid) {
    throw new DidwwClientError(
      'source must be a file path, a Buffer, a readable stream, a web ReadableStream or an async iterable of bytes',
    );
  }
}

/**
 * Reads a price file as downloaded (gzipped CSV) row by row.
 *
 * ```ts
 * for await (const row of readPriceFile('voice_in_prices.csv.gz')) {
 *   console.log(row['Rate (USD, excl. VAT)']);
 * }
 * ```
 *
 * A path is opened on the first iteration and closed when the iteration ends,
 * also on `break`. A stream source is consumed, and destroyed (a web
 * `ReadableStream` cancelled, also while it is waiting for data) when the
 * iteration ends early or fails; an async iterable is then no longer read and
 * is returned. Input of several gzip members is read in
 * full; after a member, a zero byte and everything that follows it are ignored
 * as padding (zlib does so), a later member included, however the input is
 * split into chunks and however fast the rows are read. A leading UTF-8 byte
 * order mark is skipped, invalid UTF-8 reads as U+FFFD and empty lines are
 * skipped.
 *
 * The iteration fails with the zlib error (`Z_BUF_ERROR` for gzip data cut
 * short, an empty input or a single byte after the gzip data; `Z_DATA_ERROR`
 * for input that is not gzip, a bad checksum or two or more bytes after the
 * gzip data that do not start with a zero byte), with `DidwwClientError` for
 * bad CSV quoting, a row whose number of fields differs from the header's or a
 * record over the limits (1,024 fields, 1,048,576 characters in a field,
 * 4,194,304 in the record), or with the error of the file or stream. After a
 * CSV error the rows before it have been yielded. After a zlib error the last
 * rows before the damage (tens of KiB of CSV, depending on the Node version and
 * how fast rows are read, so all rows of a small file) may not have been.
 */
export function readPriceFile(source: PriceFileSource): AsyncGenerator<PriceFileRow, void, undefined> {
  checkSource(source);
  return rows(source);
}

// An abort of `signal` tears the streams down and ends the rows without an error, also while waiting for data.
async function* rows(source: PriceFileSource, signal?: AbortSignal): AsyncGenerator<PriceFileRow, void, undefined> {
  const input = inputOf(source);
  const gunzip = zlib.createGunzip();
  // Stops the feeding when the rows end without completing, also after padding has ended gunzip early.
  const stop = new AbortController();
  const forward = () => stop.abort(signal!.reason);
  if (signal?.aborted) forward();
  else signal?.addEventListener('abort', forward, { once: true });
  const feeding = feedGunzip(input as AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>, gunzip, stop.signal);
  feeding.catch(() => undefined);
  const decoder = new TextDecoder('utf-8');
  const parser = new CsvParser();
  const records: CsvRecord[] = [];
  let header: string[] | null = null;
  let completed = false;

  function* toRows(): Generator<PriceFileRow> {
    for (const { fields, line } of records) {
      if (header === null) {
        header = fields;
      } else if (fields.length !== header.length) {
        throw new DidwwClientError(`price file record on line ${line}: wrong number of fields`);
      } else {
        // fromEntries defines own properties, so a "__proto__" column is a plain key.
        const names: string[] = header;
        yield Object.freeze(Object.fromEntries(names.map((name, i) => [name, fields[i]])));
      }
    }
    records.length = 0;
  }

  // Runs a parser step; the rows it completed before a format error are yielded before the error.
  function* parse(step: () => void): Generator<PriceFileRow> {
    let failure: unknown = null;
    try {
      step();
    } catch (e) {
      failure = e;
    }
    yield* toRows();
    if (failure !== null) throw failure;
  }

  try {
    for await (const chunk of gunzip) {
      yield* parse(() => parser.push(decoder.decode(chunk as Buffer, { stream: true }), records));
    }
    await feeding;
    yield* parse(() => {
      parser.push(decoder.decode(), records);
      parser.end(records);
    });
    completed = true;
  } catch (e) {
    if (!signal?.aborted) throw e;
  } finally {
    signal?.removeEventListener('abort', forward);
    gunzip.destroy();
    if (!completed) stop.abort();
    if (typeof source === 'string') (input as NodeJS.ReadableStream & { destroy(): void }).destroy();
  }
}

/**
 * The rows of a price file (see `readPriceFile`) as an async iterable that can
 * be closed. The file is opened on the first iteration; `close()` ends an
 * iteration in progress, also one waiting for data, and closes the file or
 * the stream source (a web `ReadableStream` is cancelled). It is iterated once.
 */
export class PriceFileReader implements AsyncIterable<PriceFileRow> {
  readonly #source: PriceFileSource;
  #rows: AsyncGenerator<PriceFileRow, void, undefined> | null = null;
  readonly #abort = new AbortController();
  #closed = false;

  constructor(source: PriceFileSource) {
    checkSource(source);
    this.#source = source;
  }

  [Symbol.asyncIterator](): AsyncGenerator<PriceFileRow, void, undefined> {
    if (this.#closed) return empty();
    this.#rows ??= rows(this.#source, this.#abort.signal);
    return this.#rows;
  }

  /** Ends the iteration, also one waiting for data, and closes a file the reader opened and a stream source. */
  async close(): Promise<void> {
    this.#closed = true;
    this.#abort.abort();
    await this.#rows?.return(undefined);
    // Also a stream no iteration has read from yet; cancel() refuses a locked web stream.
    const source = this.#source;
    if (isWebStream(source)) {
      source.cancel().catch(() => undefined);
    } else if (typeof source === 'object' && !(source instanceof Uint8Array)) {
      (source as { destroy?: () => void }).destroy?.();
    }
  }
}

async function* empty(): AsyncGenerator<PriceFileRow, void, undefined> {
  // The rows of a closed reader: none.
}

function inputOf(source: PriceFileSource) {
  if (typeof source === 'string') return createReadStream(source);
  if (source instanceof Uint8Array) return [source];
  return source;
}
