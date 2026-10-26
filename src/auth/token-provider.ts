import { createHash, timingSafeEqual } from 'node:crypto';
import type http from 'node:http';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { AuthErrorKind, DidwwAuthError } from '../errors.js';
import { BodyReadError, MAX_ERROR_BODY, readAll } from '../http/body.js';
import {
  describeFailure,
  isTlsFailure,
  RequestSetupError,
  retryAfterSeconds,
  secureRandom,
  spread,
  type Transport,
} from '../http/transport.js';
import { safeLog, type DidwwLogger } from '../logger.js';
import { ACCESS_TOKEN_BRAND, AccessToken } from './access-token.js';
import { FLIGHTS, KEY_LOCKS, mapFor, RATE_LIMITS, REFUSED, type TestingHooks } from './state.js';
import { MemoryTokenStore, type TokenStore } from './token-store.js';

export const CACHE_KEY_PREFIX = 'didww:token:v1:';
export const MAX_MINT_ATTEMPTS = 4;
const BACKOFF_BASE = 0.5;
const BACKOFF_CAP = 8;
const MINT_TIMEOUT_MS = 10_000;
const STORE_TIMEOUT_MS = 10_000;
const HEADER_TOKEN_RE = /^[\x21-\x7e]+$/;

const STORE_READ_FAILED = 'DIDWW token store read failed';
const STORE_WRITE_FAILED = 'DIDWW token store write failed';
const STORE_WRITE_SKIPPED = 'DIDWW token store write skipped';
const STORE_DELETE_FAILED = 'DIDWW token store delete failed';
const FAILED = Symbol('failed');
const SKIPPED = Symbol('skipped');
const TIMED_OUT = Symbol('timed out');

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

function isHeaderToken(value: unknown): value is string {
  return typeof value === 'string' && HEADER_TOKEN_RE.test(value);
}

/** An `AccessToken`, also one built by another copy of the SDK (an ESM and a CJS build loaded together). */
function isAccessToken(value: unknown): value is AccessToken {
  if (value instanceof AccessToken) return true;
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as { [ACCESS_TOKEN_BRAND]?: unknown })[ACCESS_TOKEN_BRAND] === true &&
    typeof (value as { accessToken?: unknown }).accessToken === 'string'
  );
}

export interface TokenProviderOptions {
  transport: Transport;
  authUrl: string;
  apiKey: string;
  apiVersion: string;
  scope: string | null;
  store: TokenStore;
  logger: DidwwLogger;
  hooks?: TestingHooks;
}

/**
 * Mints access tokens per audience, caches them in the store and shares one
 * mint among concurrent callers.
 *
 * 5xx answers and transport failures other than TLS errors are tried up to
 * `MAX_MINT_ATTEMPTS` times in all, with a full-jitter backoff. Each attempt
 * must be answered in full within 10 s. A 429 blocks further mints of the
 * same token service and API key, in this process, until its Retry-After
 * plus a small random delay has passed.
 */
export class TokenProvider {
  readonly #apiKey: string;
  readonly #apiKeyDigest: string;
  readonly #transport: Transport;
  readonly #authUrl: string;
  readonly #tokenUrl: URL;
  readonly #apiVersion: string;
  readonly #scope: string | null;
  readonly #store: TokenStore;
  readonly #logger: DidwwLogger;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #random: () => number;
  readonly #now: () => number;
  readonly #mintTimeoutMs: number;
  readonly #storeTimeoutMs: number;

  constructor(options: TokenProviderOptions) {
    this.#apiKey = options.apiKey;
    this.#apiKeyDigest = sha256Hex(options.apiKey);
    this.#transport = options.transport;
    this.#authUrl = options.authUrl;
    this.#tokenUrl = new URL(`${options.authUrl}/token`);
    this.#apiVersion = options.apiVersion;
    this.#scope = options.scope;
    this.#store = options.store;
    this.#logger = options.logger;
    const hooks = options.hooks ?? {};
    this.#sleep = hooks.sleep ?? ((ms) => delay(ms));
    this.#random = hooks.random ?? secureRandom;
    this.#now = hooks.now ?? (() => performance.now());
    this.#mintTimeoutMs = hooks.mintTimeoutMs ?? MINT_TIMEOUT_MS;
    this.#storeTimeoutMs = hooks.storeTimeoutMs ?? STORE_TIMEOUT_MS;
  }

  cacheKey(audience: string): string {
    const material = [this.#authUrl, this.#apiKeyDigest, audience, this.#apiVersion, this.#scope ?? '-'].join('\n');
    return CACHE_KEY_PREFIX + sha256Hex(material);
  }

  /** The cached token of `audience`, or a new one; rejects with `DidwwAuthError`. */
  async token(audience: string): Promise<AccessToken> {
    const key = this.cacheKey(audience);
    const cached = await this.#readCached(key);
    if (cached) return cached;

    const flights = mapFor(FLIGHTS, this.#store);
    const existing = flights.get(key);
    if (existing) return existing;
    const flight: Promise<AccessToken> = (async () => {
      const again = await this.#readCached(key);
      if (again) return again;
      const minted = await this.#mint(audience);
      await this.#storeToken(key, minted);
      return minted;
    })().finally(() => {
      if (flights.get(key) === flight) flights.delete(key);
    });
    flights.set(key, flight);
    return flight;
  }

  /**
   * Evicts the cached token of `audience` only while it is still the refused
   * one. The refused token is remembered, so that a store that keeps it is
   * not trusted until a new token has been stored.
   */
  async invalidate(audience: string, refusedAccessToken: string): Promise<void> {
    const key = this.cacheKey(audience);
    mapFor(REFUSED, this.#store).set(key, refusedAccessToken);
    await this.#withKeyLock(key, async () => {
      const stored = await this.#getStored(key);
      if (stored && sameToken(stored.accessToken, refusedAccessToken)) {
        await this.#callStore(() => this.#store.delete(key), STORE_DELETE_FAILED);
      }
    });
  }

  backoffMs(attempt: number): number {
    return this.#random() * Math.min(BACKOFF_CAP, BACKOFF_BASE * 2 ** Math.min(attempt, 16)) * 1000;
  }

  async #readCached(key: string): Promise<AccessToken | null> {
    const stored = await this.#getStored(key);
    if (!stored) return null;
    const refused = REFUSED.get(this.#store)?.get(key);
    if (refused !== undefined && sameToken(refused, stored.accessToken)) return null;
    return stored;
  }

  async #getStored(key: string): Promise<AccessToken | null> {
    const stored = await this.#callStore(() => this.#store.get(key), STORE_READ_FAILED);
    if (stored === FAILED || stored === null || stored === undefined) return null;
    let failure: Error;
    if (!isAccessToken(stored)) {
      failure = new TypeError('get returned a value that is not an AccessToken');
    } else if (!isHeaderToken(stored.accessToken)) {
      failure = new TypeError('get returned an AccessToken whose access token is not valid');
    } else {
      return stored;
    }
    this.#warn(STORE_READ_FAILED, failure);
    return null;
  }

  async #storeToken(key: string, token: AccessToken): Promise<void> {
    const refused = mapFor(REFUSED, this.#store);
    const refusedBefore = refused.get(key);
    const outcome = await this.#withKeyLock(key, async () => {
      const result = await this.#callStore(() => this.#store.set(key, token, token.expiresIn), STORE_WRITE_FAILED);
      if (result !== FAILED && refusedBefore !== undefined && refused.get(key) === refusedBefore) {
        refused.delete(key);
      }
    });
    if (outcome === SKIPPED) {
      this.#warn(STORE_WRITE_SKIPPED, new Error(`the store lock was not free within ${this.#storeTimeoutMs} ms`));
    }
  }

  // A promise-chain mutex per store and key; gives up when not acquired in time.
  async #withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T | typeof SKIPPED> {
    const locks = mapFor(KEY_LOCKS, this.#store);
    const previous = locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => (release = resolve));
    const tail = previous.then(() => mine);
    locks.set(key, tail);
    try {
      const acquired = await this.#bounded(previous);
      if (acquired === TIMED_OUT) return SKIPPED;
      return await fn();
    } finally {
      release();
      if (locks.get(key) === tail) locks.delete(key);
    }
  }

  async #bounded<T>(promise: Promise<T>): Promise<T | typeof TIMED_OUT> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), this.#storeTimeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  // The in-memory store is called directly; any other store gets the store
  // timeout per call, so a hung or failing store never fails the API call.
  async #callStore<T>(call: () => T | Promise<T>, failure: string): Promise<Awaited<T> | typeof FAILED> {
    if (this.#store.constructor === MemoryTokenStore) {
      try {
        return (await call()) as Awaited<T>;
      } catch (e) {
        this.#warn(failure, e);
        return FAILED;
      }
    }
    const pending = Promise.resolve().then(call);
    pending.catch(() => undefined);
    try {
      const result = await this.#bounded(pending);
      if (result === TIMED_OUT) {
        this.#warn(failure, new Error(`the store call did not finish within ${this.#storeTimeoutMs} ms`));
        return FAILED;
      }
      return result as Awaited<T>;
    } catch (e) {
      this.#warn(failure, e);
      return FAILED;
    }
  }

  async #mint(audience: string): Promise<AccessToken> {
    this.#raiseIfRateLimited();
    const request: Record<string, unknown> = { aud: [audience], api_version: this.#apiVersion };
    if (this.#scope !== null) request.scope = this.#scope;
    const payload = Buffer.from(JSON.stringify(request));

    const start = this.#now();
    const { status, retryAfter, body } = await this.#post(payload);
    const token = this.#tokenFrom(status, retryAfter, body, audience);
    safeLog(
      this.#logger,
      'debug',
      `DIDWW token minted: aud ${JSON.stringify(token.aud)}, scope ${token.scope}, api_version ${token.apiVersion},` +
        ` expires_in ${token.expiresIn}, duration_ms ${Math.round(this.#now() - start)}`,
    );
    return token;
  }

  async #post(payload: Buffer): Promise<{ status: number; retryAfter: string | undefined; body: Buffer }> {
    for (let attempt = 1; ; attempt++) {
      const last = attempt >= MAX_MINT_ATTEMPTS;
      const outcome = await this.#attempt(payload);
      if ('status' in outcome) {
        if (outcome.status < 500 || last) return outcome;
      } else if ('fatal' in outcome) {
        throw new DidwwAuthError({
          kind: AuthErrorKind.CONNECTION_ERROR,
          message: `Token service: the token request ${outcome.fatal}`,
        });
      } else if ('unread' in outcome) {
        if (last) {
          // The cut body of a 200 may hold the token: no cause is kept.
          throw new DidwwAuthError({
            kind: AuthErrorKind.CONNECTION_ERROR,
            status: 200,
            message: `Token service: the token response could not be read (${outcome.unread})`,
          });
        }
      } else if (last || isTlsFailure(outcome.failure)) {
        const failure = outcome.failure;
        const text = failure instanceof Error ? failure.message : String(failure);
        throw new DidwwAuthError({
          kind: AuthErrorKind.CONNECTION_ERROR,
          message: `Token service: ${describeFailure(failure)}: ${text}`,
          cause: failure,
        });
      }
      await this.#sleep(this.backoffMs(attempt));
      this.#raiseIfRateLimited();
    }
  }

  async #attempt(
    payload: Buffer,
  ): Promise<
    | { status: number; retryAfter: string | undefined; body: Buffer }
    | { fatal: string }
    | { unread: string }
    | { failure: unknown }
  > {
    let res: http.IncomingMessage;
    try {
      res = await this.#transport.send(
        {
          method: 'POST',
          url: this.#tokenUrl,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'identity',
            'Api-Key': this.#apiKey,
          },
          body: payload,
          timeouts: { connect: this.#mintTimeoutMs, read: this.#mintTimeoutMs, total: this.#mintTimeoutMs },
        },
        undefined,
      );
    } catch (e) {
      if (e instanceof RequestSetupError) return { fatal: `could not be sent (${e.code})` };
      if (e instanceof Error) return { failure: e };
      return { fatal: `failed (${typeof e})` };
    }
    const status = res.statusCode ?? 0;
    try {
      const body = await readAll(res, { limit: MAX_ERROR_BODY, strict: status === 200 });
      return { status, retryAfter: headerValue(res.headers['retry-after']), body };
    } catch (e) {
      if (e instanceof BodyReadError) return { unread: describeFailure(e.cause) };
      return { fatal: `failed (${e instanceof Error ? e.name : typeof e})` };
    } finally {
      res.destroy();
    }
  }

  #tokenFrom(status: number, retryAfter: string | undefined, body: Buffer, audience: string): AccessToken {
    const fields = jsonObject(body);
    const error = text(fields, 'error');
    let description = text(fields, 'error_description');

    if (status === 200) {
      const token = new AccessToken({
        accessToken: text(fields, 'access_token') ?? '',
        tokenType: text(fields, 'token_type') ?? 'Bearer',
        expiresIn: nonNegativeInt(fields, 'expires_in'),
        aud: audienceOf(fields),
        scope: text(fields, 'scope'),
        apiVersion: text(fields, 'api_version'),
        mintedAt: new Date(),
      });
      this.#verifyGrant(token, audience);
      return token;
    }
    if (status === 429) {
      const parsed = retryAfterSeconds(retryAfter);
      const seconds = parsed === null ? 1 : Math.max(1, parsed);
      RATE_LIMITS.set(this.#rateLimitKey(), this.#now() + spread(seconds, this.#random) * 1000);
      throw new DidwwAuthError({
        kind: AuthErrorKind.RATE_LIMITED,
        status,
        error,
        errorDescription: description,
        retryAfter: seconds,
      });
    }
    let kind: AuthErrorKind;
    if (status === 400) kind = AuthErrorKind.INVALID_REQUEST;
    else if (status === 401) kind = AuthErrorKind.INVALID_CLIENT;
    else if (status >= 500 && status <= 599) kind = AuthErrorKind.SERVER_ERROR;
    else {
      kind = AuthErrorKind.UNEXPECTED_STATUS;
      if (status >= 300 && status <= 399 && error === null && description === null) {
        description = 'the token request was redirected; redirects are not followed';
      }
    }
    throw new DidwwAuthError({ kind, status, error, errorDescription: description });
  }

  #verifyGrant(token: AccessToken, audience: string): void {
    if (!isHeaderToken(token.accessToken)) {
      throw new DidwwAuthError({
        kind: AuthErrorKind.INVALID_GRANT,
        status: 200,
        errorDescription: 'the granted access token is empty or not a valid header value',
      });
    }
    if (!token.aud.includes(audience)) {
      throw new DidwwAuthError({
        kind: AuthErrorKind.INVALID_GRANT,
        status: 200,
        errorDescription: `granted audience ${JSON.stringify(token.aud)}, requested ${audience}`,
      });
    }
    if (this.#scope !== null && token.scope !== this.#scope) {
      safeLog(this.#logger, 'warn', `DIDWW token scope mismatch: requested ${this.#scope}, granted ${token.scope}`);
    }
    if (token.apiVersion !== this.#apiVersion) {
      safeLog(
        this.#logger,
        'warn',
        `DIDWW token api_version mismatch: requested ${this.#apiVersion}, granted ${token.apiVersion}`,
      );
    }
  }

  #raiseIfRateLimited(): void {
    const key = this.#rateLimitKey();
    const until = RATE_LIMITS.get(key);
    if (until === undefined) return;
    const remaining = until - this.#now();
    if (remaining <= 0) {
      RATE_LIMITS.delete(key);
      return;
    }
    throw new DidwwAuthError({
      kind: AuthErrorKind.RATE_LIMITED,
      status: 429,
      error: 'rate_limit_exceeded',
      retryAfter: Math.max(1, Math.ceil(remaining / 1000)),
    });
  }

  #rateLimitKey(): string {
    return `${this.#authUrl}\n${this.#apiKeyDigest}`;
  }

  #warn(message: string, error: unknown): void {
    safeLog(this.#logger, 'warn', message, { error });
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function jsonObject(body: Buffer): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    parsed = null;
  }
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function text(fields: Record<string, unknown>, name: string): string | null {
  const value = Object.prototype.hasOwnProperty.call(fields, name) ? fields[name] : undefined;
  return typeof value === 'string' ? value : null;
}

function nonNegativeInt(fields: Record<string, unknown>, name: string): number {
  const value = fields[name];
  return typeof value === 'number' && Number.isSafeInteger(value) ? Math.max(0, value) : 0;
}

function audienceOf(fields: Record<string, unknown>): string[] {
  const value = fields.aud;
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((a): a is string => typeof a === 'string');
  return [];
}
