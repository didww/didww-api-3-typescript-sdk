import { performance } from 'node:perf_hooks';
import { inspect } from 'node:util';
import type { AccessToken } from './access-token.js';

/**
 * Where access tokens are kept between calls. Methods may be synchronous or
 * return promises (for example a Redis client).
 *
 * Keys cover the token service, a digest of the API key, the audience, the
 * API version and the scope, so one store can serve several clients and
 * processes. The store holds live bearer tokens: protect it like the API key.
 * Persist tokens with `AccessToken#toData()` and `AccessToken.fromData()`.
 *
 * Calls to a store other than `MemoryTokenStore` are given 10 seconds each; a
 * store that fails or takes longer is logged and skipped, never failing the
 * API call. Processes that share a store are not serialized: on a cold start
 * each may mint its own token.
 */
export interface TokenStore {
  /** The token stored under `key`, or null/undefined when there is none or it expired. */
  get(key: string): AccessToken | null | undefined | Promise<AccessToken | null | undefined>;
  /** Stores `token` under `key` for `ttlSeconds`; `ttlSeconds <= 0` means no expiry. */
  set(key: string, token: AccessToken, ttlSeconds: number): void | Promise<void>;
  /** Removes the token stored under `key`, if any. */
  delete(key: string): void | Promise<void>;
}

export interface MemoryTokenStoreOptions {
  /** A monotonic clock in milliseconds; `performance.now` by default. */
  now?: () => number;
}

/** An in-process `TokenStore`. Expired tokens are dropped on read. */
export class MemoryTokenStore implements TokenStore {
  readonly #entries = new Map<string, { token: AccessToken; deadline: number | null }>();
  readonly #now: () => number;

  constructor(options: MemoryTokenStoreOptions = {}) {
    this.#now = options.now ?? (() => performance.now());
  }

  get(key: string): AccessToken | null {
    const entry = this.#entries.get(key);
    if (!entry) return null;
    if (entry.deadline !== null && this.#now() >= entry.deadline) {
      this.#entries.delete(key);
      return null;
    }
    return entry.token;
  }

  set(key: string, token: AccessToken, ttlSeconds: number): void {
    const deadline = ttlSeconds > 0 ? this.#now() + ttlSeconds * 1000 : null;
    this.#entries.set(key, { token, deadline });
  }

  delete(key: string): void {
    this.#entries.delete(key);
  }

  /** Removes every token. */
  clear(): void {
    this.#entries.clear();
  }

  /** The number of entries, expired ones not yet dropped included. */
  get size(): number {
    return this.#entries.size;
  }

  toJSON(): Record<string, unknown> {
    return { entries: this.#entries.size };
  }

  [inspect.custom](): string {
    return `MemoryTokenStore { entries: ${this.#entries.size} }`;
  }
}

/** The store of clients built without one: shared by every client of the process. */
export const DEFAULT_TOKEN_STORE = new MemoryTokenStore();

export function isTokenStore(value: unknown): value is TokenStore {
  if (value === null || typeof value !== 'object') return false;
  const store = value as Record<string, unknown>;
  return typeof store.get === 'function' && typeof store.set === 'function' && typeof store.delete === 'function';
}
