import { promises as fs } from 'node:fs';
import type http from 'node:http';
import { inspect } from 'node:util';
import { Audience } from '../configuration.js';
import { DidwwClientError, DidwwError, DidwwPricesError, PricesErrorKind, type JsonApiError } from '../errors.js';
import { writeFileAtomically, type AtomicFileOptions } from '../http/atomic-file.js';
import { BodyReadError, contentCoding, decodeBody, rawChunks, readErrorBody, writeIntoStream } from '../http/body.js';
import {
  contentLength,
  describeFailure,
  retryAfterSeconds,
  spread,
  TimeoutError,
  type SendOptions,
  type Tokens,
  type Transport,
} from '../http/transport.js';
import { contentDispositionFilename, formatHttpDate, isHttpDate, parseHttpDate } from './http-headers.js';
import {
  parseLookup,
  SMS_IN_FIELDS,
  SMS_OUT_FIELDS,
  VOICE_IN_FIELDS,
  VOICE_OUT_FIELDS,
  type PriceLookup,
  type RowFields,
} from './rows.js';

const FILE_NAME = 'prices.csv.gz';
const LOOKUP_PATH = 'lookup/prices';
const JSONAPI_MEDIA_TYPE = 'application/vnd.api+json';
const CODE_PRICE_PLAN_NOT_ASSIGNED = 'price_plan_not_assigned';
const CODE_PRICE_NOT_FOUND = 'price_not_found';
const MAX_UNAVAILABLE_RETRIES = 2;
const MAX_UNAVAILABLE_RETRY_AFTER = 60;

const KINDS: Readonly<Record<number, PricesErrorKind>> = {
  400: PricesErrorKind.BAD_REQUEST,
  401: PricesErrorKind.NOT_AUTHORIZED,
  403: PricesErrorKind.ACCESS_DENIED,
  406: PricesErrorKind.NOT_ACCEPTABLE,
  429: PricesErrorKind.TOO_MANY_REQUESTS,
  503: PricesErrorKind.SERVICE_UNAVAILABLE,
};

/** Lookup filters of the Voice IN prices: `number` (required) and `src_country_iso`. */
export interface VoiceInPriceFilters {
  number: string | number;
  src_country_iso?: string | null;
}

/** Lookup filters of the Voice OUT prices: `number` (required). */
export interface VoiceOutPriceFilters {
  number: string | number;
}

/** Lookup filters of the SMS prices: `dst_number`, `dst_country_iso` or both. */
export type SmsPriceFilters =
  | { dst_number: string | number; dst_country_iso?: string | null }
  | { dst_number?: string | number | null; dst_country_iso: string };

/** Options of a price file request. */
export interface PricesRequestOptions {
  /** Sent as If-Modified-Since, in whole seconds; a file that has not changed since answers 304. */
  ifModifiedSince?: Date | null;
}

/** The answer to a price file request. */
export interface PriceFile {
  /** 200, or 304 when the file has not changed since If-Modified-Since. */
  readonly status: 200 | 304;
  /** The Last-Modified of the answer, or null when absent or not an IMF-fixdate. */
  readonly lastModified: Date | null;
  /** The size of the file in bytes, or null when unknown (always on 304). */
  readonly contentLength: number | null;
  /** The file name of the Content-Disposition, or null. */
  readonly filename: string | null;
  /** The bytes written by a download; 0 for `head()` and 304. */
  readonly bytesWritten: number;
  /** Whether the file has not changed since the If-Modified-Since date sent (304). */
  readonly notModified: boolean;
}

/** @internal What a prices service needs from the client. */
export interface PricesContext {
  readonly transport: Transport;
  readonly tokens: Tokens;
  readonly readTimeout: number | null;
  readonly urls: { readonly voiceIn: string; readonly voiceOut: string; readonly sms: string };
  readonly sleep: (ms: number) => Promise<void>;
  readonly random: () => number;
}

/** @internal One price list of a prices service. */
export interface PriceList {
  readonly url: 'voiceIn' | 'voiceOut' | 'sms';
  readonly audience: Audience;
  readonly prefix: string;
  readonly fields: RowFields;
  readonly required: readonly string[];
  readonly optional: readonly string[];
  readonly anyOf: readonly string[];
}

const priceList = (list: PriceList): PriceList =>
  Object.freeze({
    ...list,
    required: Object.freeze([...list.required]),
    optional: Object.freeze([...list.optional]),
    anyOf: Object.freeze([...list.anyOf]),
  });

const SMS_FILTERS = { required: [], optional: [], anyOf: ['dst_number', 'dst_country_iso'] };

/** @internal */
export const PRICE_LISTS = Object.freeze({
  voiceIn: priceList({
    url: 'voiceIn',
    audience: Audience.VOICE_IN,
    prefix: '',
    fields: VOICE_IN_FIELDS,
    required: ['number'],
    optional: ['src_country_iso'],
    anyOf: [],
  }),
  voiceOut: priceList({
    url: 'voiceOut',
    audience: Audience.VOICE_OUT,
    prefix: '',
    fields: VOICE_OUT_FIELDS,
    required: ['number'],
    optional: [],
    anyOf: [],
  }),
  smsOutA2p: priceList({
    url: 'sms',
    audience: Audience.SMS,
    prefix: 'sms_out/a2p/',
    fields: SMS_OUT_FIELDS,
    ...SMS_FILTERS,
  }),
  smsOutP2p: priceList({
    url: 'sms',
    audience: Audience.SMS,
    prefix: 'sms_out/p2p/',
    fields: SMS_OUT_FIELDS,
    ...SMS_FILTERS,
  }),
  smsOutOtp: priceList({
    url: 'sms',
    audience: Audience.SMS,
    prefix: 'sms_out/otp/',
    fields: SMS_OUT_FIELDS,
    ...SMS_FILTERS,
  }),
  smsIn: priceList({ url: 'sms', audience: Audience.SMS, prefix: 'sms_in/', fields: SMS_IN_FIELDS, ...SMS_FILTERS }),
});

/** `path` under the `/v3` of a prices service base URL, which may or may not end with `/v3`. */
export function joinV3(base: string, path: string): string {
  let root = base.endsWith('/') ? base.slice(0, -1) : base;
  if (!root.endsWith('/v3')) root += '/v3';
  return `${root}/${path}`;
}

// Thrown through writeFileAtomically so that a 304 leaves the target untouched.
class NotModified {
  constructor(readonly file: PriceFile) {}
}

/**
 * One price list of a prices service: its price file, a gzipped CSV, and its
 * lookup. Obtain it from the price accessors of `DidwwClient`, such as
 * `client.voiceInPrices()`. Requests carry an access token for the service
 * host. Without a price plan of the service every call fails with
 * `PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED`.
 *
 * A failed call rejects with `DidwwPricesError` (see its `kind`), or with
 * `DidwwAuthError` when no access token could be obtained; invalid arguments
 * reject with `DidwwClientError` before any request. Redirects are never
 * followed: a 3xx answer is `UNEXPECTED_STATUS`. A 503 answer to a file
 * request whose Retry-After is at most a minute is retried up to twice, after
 * that Retry-After (at least a second) plus a small random delay; no other
 * answer is retried, except once with a new token after a 401. Error bodies
 * are read up to 1 MiB and within the read timeout.
 */
export class PricesService<Row, Filters> {
  /** The path of the price file under `/v3`, such as `sms_out/a2p/prices.csv.gz`. */
  readonly filePath: string;
  /** The path of the lookup under `/v3`, such as `sms_out/a2p/lookup/prices`. */
  readonly lookupPath: string;
  /** The lookup filter names this service accepts. */
  readonly allowedFilters: readonly string[];
  readonly #context: PricesContext;
  readonly #list: PriceList;
  readonly #baseUrl: string;

  /** @internal Use the price accessors of `DidwwClient`. */
  constructor(context: PricesContext, list: PriceList) {
    this.#context = context;
    this.#list = list;
    this.#baseUrl = context.urls[list.url];
    this.filePath = list.prefix + FILE_NAME;
    this.lookupPath = list.prefix + LOOKUP_PATH;
    this.allowedFilters = Object.freeze([...list.required, ...list.optional, ...list.anyOf]);
  }

  [inspect.custom](): string {
    return `PricesService(${joinV3(this.#baseUrl, this.lookupPath)})`;
  }

  // --- Lookup ---

  /**
   * Returns the prices matching `filters`, such as `{ number: '18005550123' }`.
   *
   * Filter names are the wire names without `filter[...]`. Null, undefined and
   * blank values are dropped. A missing or unknown filter rejects with
   * `DidwwClientError` before any request; the formats of the values are
   * checked by the service (`BAD_REQUEST`). The rows are frozen, with money as
   * decimal strings.
   *
   * @throws {DidwwPricesError} The service answered with another status than 200, or could not be reached.
   * @throws {DidwwClientError} A filter is missing or not allowed, or the 200 answer cannot be parsed or holds no prices.
   */
  async lookup(filters: Filters): Promise<PriceLookup<Row>> {
    const query = this.#query(filters);
    const url = new URL(`${joinV3(this.#baseUrl, this.lookupPath)}?${query}`);
    const res = await this.#send({
      method: 'GET',
      url,
      headers: { Accept: JSONAPI_MEDIA_TYPE, 'Accept-Encoding': 'identity' },
    });
    const chunks: Buffer[] = [];
    let coding: string;
    try {
      if (res.statusCode !== 200) throw await this.#error(res);
      await copyBody(res, async (chunk) => {
        chunks.push(chunk);
      });
      coding = contentCoding(res);
    } finally {
      res.destroy();
    }
    let document: unknown;
    try {
      const body = await decodeBody(Buffer.concat(chunks), coding);
      document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new DidwwClientError(`Failed to parse price lookup: ${reason}`, { cause: e });
    }
    return parseLookup<Row>(document, this.#list.fields);
  }

  #query(filters: unknown): string {
    const given = givenFilters(filters);
    const names = [...given.keys()].sort(byCodeUnits);
    const unknown = names.filter((name) => !this.allowedFilters.includes(name));
    if (unknown.length > 0) {
      throw new DidwwClientError(
        `Filter ${unknown.join(', ')} is not allowed on ${this.lookupPath} (allowed: ${this.allowedFilters.join(', ')})`,
      );
    }
    const missing = this.#list.required.filter((name) => !given.has(name));
    if (missing.length > 0) {
      throw new DidwwClientError(`Filter ${missing.join(', ')} is required on ${this.lookupPath}`);
    }
    const anyOf = this.#list.anyOf;
    if (anyOf.length > 0 && !anyOf.some((name) => given.has(name))) {
      throw new DidwwClientError(`One of filters ${anyOf.join(', ')} is required on ${this.lookupPath}`);
    }
    return names.map((name) => `filter[${name}]=${encodeURIComponent(given.get(name)!)}`).join('&');
  }

  // --- Price file ---

  /**
   * Returns the metadata of the price file without its content. A given
   * `ifModifiedSince` is sent as If-Modified-Since in whole seconds; a file
   * that has not changed since answers 304 (`PriceFile.notModified`).
   *
   * @throws {DidwwPricesError} The service answered with another status than 200 or 304, or could not be reached.
   * @throws {DidwwClientError} `ifModifiedSince` is not a valid Date of the years 1 to 9999.
   */
  async head(options: PricesRequestOptions = {}): Promise<PriceFile> {
    return this.#requestFile('HEAD', ifModifiedSince(options), null);
  }

  /**
   * Writes the price file to `destination` exactly as served: gzipped, never
   * decompressed (see `readPriceFile`). The stream is left open. A given
   * `ifModifiedSince` is sent as in `head()`; a 304 answer writes nothing.
   * Only a 200 answer is written, but the stream may hold partial data when
   * the transfer fails; a body shorter than its Content-Length is
   * `CONNECTION_ERROR`. Errors of the stream itself, also one it emits during
   * the call, propagate unchanged.
   *
   * @throws {DidwwPricesError} The service answered with another status than 200 or 304, or the transfer failed.
   * @throws {DidwwClientError} `destination` is not a writable stream, or it is closed, or `ifModifiedSince` is invalid.
   */
  async download(destination: NodeJS.WritableStream, options: PricesRequestOptions = {}): Promise<PriceFile> {
    if (
      destination === null ||
      typeof destination !== 'object' ||
      typeof (destination as { write?: unknown }).write !== 'function'
    ) {
      throw new DidwwClientError('destination must be a writable stream');
    }
    const since = ifModifiedSince(options);
    return writeIntoStream(destination, (write) => this.#requestFile('GET', since, write));
  }

  /**
   * Downloads the price file to `path`.
   *
   * The file is written to a temporary file next to `path`, flushed to the
   * disk and moved over `path` only when the whole file has arrived, so a
   * failed download leaves an existing file as it was; the temporary file is
   * created first, so a missing directory fails without a request. The new
   * file gets the mode of a new file (0666 minus the umask), not the mode of
   * the file it replaces, and the Last-Modified of the answer as its
   * modification time. A symlink at `path` is replaced, not followed. On
   * Windows the replacement fails while `path` is open, for example by a
   * `PriceFileReader`.
   *
   * @throws {DidwwPricesError} The service answered with another status than 200, or the transfer failed.
   * @throws {DidwwClientError} `path` is not a non-empty string.
   * The errors of the file system (such as `ENOENT` or `ENOSPC`) propagate unchanged.
   */
  async downloadToFile(path: string): Promise<PriceFile> {
    checkPath(path);
    return this.#downloadToFile(path, null);
  }

  /**
   * Downloads the price file to `path` like `downloadToFile()` unless the file
   * there is current: the modification time of an existing file is sent as
   * If-Modified-Since, and a 304 answer leaves the file and its modification
   * time untouched (`PriceFile.notModified`). It trusts the modification time
   * of any file at `path`.
   *
   * @throws {DidwwPricesError} The service answered with another status than 200 or 304, or the transfer failed.
   * @throws {DidwwClientError} `path` is not a non-empty string.
   * The errors of the file system propagate unchanged.
   */
  async fetch(path: string): Promise<PriceFile> {
    checkPath(path);
    let since: Date | null = null;
    try {
      since = modificationTime((await fs.stat(path, { bigint: true })).mtimeNs);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e;
    }
    return this.#downloadToFile(path, since);
  }

  async #downloadToFile(path: string, since: Date | null): Promise<PriceFile> {
    // writeFileAtomically reads the modification time once the file is filled, from the Last-Modified of the answer.
    const options: AtomicFileOptions = {};
    try {
      return await writeFileAtomically(
        path,
        async (write) => {
          const file = await this.#requestFile('GET', since, write);
          if (file.notModified) throw new NotModified(file);
          if (file.lastModified !== null) options.mtimeSeconds = Math.floor(file.lastModified.getTime() / 1000);
          return file;
        },
        options,
      );
    } catch (e) {
      if (e instanceof NotModified) return e.file;
      throw e;
    }
  }

  async #requestFile(
    method: 'HEAD' | 'GET',
    since: Date | null,
    write: ((chunk: Buffer) => Promise<void>) | null,
  ): Promise<PriceFile> {
    const url = new URL(joinV3(this.#baseUrl, this.filePath));
    const headers: Record<string, string> = { 'Accept-Encoding': 'identity' };
    if (since !== null) headers['If-Modified-Since'] = formatHttpDate(since);
    for (let attempt = 1; ; attempt++) {
      const res = await this.#send({ method, url, headers });
      let waitSeconds = 0;
      try {
        const status = res.statusCode;
        if (status === 200 || status === 304) return await priceFile(res, status, status === 200 ? write : null);
        const wait = this.#unavailableWait(res, attempt);
        if (wait === null) throw await this.#error(res);
        waitSeconds = wait;
        await readErrorBody(res, this.#context.readTimeout);
      } finally {
        res.destroy();
      }
      await this.#context.sleep(waitSeconds * 1000);
    }
  }

  #unavailableWait(res: http.IncomingMessage, attempt: number): number | null {
    if (res.statusCode !== 503 || attempt > MAX_UNAVAILABLE_RETRIES) return null;
    const retryAfter = retryAfterSeconds(res.headers['retry-after']);
    if (retryAfter === null || retryAfter > MAX_UNAVAILABLE_RETRY_AFTER) return null;
    return spread(Math.max(retryAfter, 1), this.#context.random);
  }

  // --- Transport and errors ---

  async #send(options: SendOptions): Promise<http.IncomingMessage> {
    try {
      return await this.#context.transport.sendAuthorized(options, this.#list.audience, this.#context.tokens);
    } catch (e) {
      if (e instanceof DidwwError) throw e;
      throw new DidwwPricesError({
        kind: PricesErrorKind.CONNECTION_ERROR,
        message: `Prices service request failed: ${describeFailure(e)}`,
        cause: e,
      });
    }
  }

  async #error(res: http.IncomingMessage): Promise<DidwwPricesError> {
    const status = res.statusCode ?? 0;
    const errors = parseErrors(await readErrorBody(res, this.#context.readTimeout));
    let code = errors.length > 0 ? errorCode(errors[0]) : null;
    let kind: PricesErrorKind;
    if (status === 404) {
      code ??= CODE_PRICE_PLAN_NOT_ASSIGNED;
      kind = code === CODE_PRICE_NOT_FOUND ? PricesErrorKind.PRICE_NOT_FOUND : PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED;
    } else {
      kind = KINDS[status] ?? PricesErrorKind.UNEXPECTED_STATUS;
    }
    return new DidwwPricesError({
      kind,
      status,
      code,
      errors,
      retryAfter: retryAfterSeconds(res.headers['retry-after']),
    });
  }
}

async function priceFile(
  res: http.IncomingMessage,
  status: 200 | 304,
  write: ((chunk: Buffer) => Promise<void>) | null,
): Promise<PriceFile> {
  const bytesWritten = write !== null ? await copyBody(res, write) : 0;
  return Object.freeze({
    status,
    lastModified: parseHttpDate(res.headers['last-modified']),
    contentLength: status === 200 ? contentLength(res) : null,
    filename: contentDispositionFilename(res.headers['content-disposition']),
    bytesWritten,
    notModified: status === 304,
  });
}

// Copies the raw body of `res` to `write` and returns its size; errors of `write` propagate unchanged.
async function copyBody(res: http.IncomingMessage, write: (chunk: Buffer) => Promise<void>): Promise<number> {
  const expected = contentLength(res);
  const counter = { count: 0 };
  try {
    for await (const chunk of rawChunks(res, counter)) await write(chunk);
  } catch (e) {
    throw e instanceof BodyReadError ? readError(e) : e;
  }
  if (expected !== null && counter.count !== expected) {
    throw connectionError(`Prices service: incomplete body: ${counter.count} of ${expected} bytes`);
  }
  return counter.count;
}

function readError(error: BodyReadError): DidwwPricesError {
  const cause = error.cause;
  if (cause instanceof TimeoutError) return connectionError(`Prices service: ${cause.message}`, cause);
  if (error.incomplete) return connectionError('Prices service: incomplete body', cause);
  return connectionError(`Prices service: failed to read the answer: ${describeFailure(cause)}`, cause);
}

function connectionError(message: string, cause?: unknown): DidwwPricesError {
  return new DidwwPricesError({ kind: PricesErrorKind.CONNECTION_ERROR, status: 200, message, cause });
}

// The order of the default sort, by UTF-16 code units: the query does not depend on the locale.
function byCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function givenFilters(filters: unknown): Map<string, string> {
  if (filters === undefined || filters === null) return new Map();
  if (typeof filters !== 'object' || Array.isArray(filters)) {
    throw new DidwwClientError('filters must be an object of filter names to values');
  }
  const given = new Map<string, string>();
  for (const [name, value] of Object.entries(filters)) {
    const text = filterValue(name, value);
    if (text !== null && text.trim() !== '') given.set(name, text);
  }
  return given;
}

function filterValue(name: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  // A phone number given as a number: only a safe integer prints as its digits.
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new DidwwClientError(`filter ${name} must be a string`);
}

function ifModifiedSince(options: PricesRequestOptions): Date | null {
  if (options === null || typeof options !== 'object') throw new DidwwClientError('options must be an object');
  const value = options.ifModifiedSince;
  if (value === undefined || value === null) return null;
  if (!isHttpDate(value)) throw new DidwwClientError('ifModifiedSince must be a valid Date of the years 1 to 9999');
  return value;
}

function checkPath(path: unknown): void {
  if (typeof path !== 'string' || path === '') throw new DidwwClientError('path must be a file path string');
}

// A file modification time as a Date in whole seconds, or null outside the years 1 to 9999.
function modificationTime(mtimeNs: bigint): Date | null {
  let seconds = mtimeNs / 1_000_000_000n;
  if (mtimeNs < 0n && seconds * 1_000_000_000n !== mtimeNs) seconds -= 1n;
  const date = new Date(Number(seconds) * 1000);
  return isHttpDate(date) ? date : null;
}

function parseErrors(body: Buffer): JsonApiError[] {
  let document: unknown;
  try {
    document = JSON.parse(body.toString('utf8'));
  } catch {
    return [];
  }
  const errors = (document as { errors?: unknown } | null)?.errors;
  if (document === null || typeof document !== 'object' || !Array.isArray(errors)) return [];
  return errors.filter((e): e is JsonApiError => e !== null && typeof e === 'object' && !Array.isArray(e));
}

function errorCode(error: JsonApiError): string | null {
  const code: unknown = error.code;
  if (typeof code === 'string') return code === '' ? null : code;
  if (typeof code === 'number' && Number.isFinite(code)) return String(code);
  return null;
}
