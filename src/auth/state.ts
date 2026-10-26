import type { AccessToken } from './access-token.js';
import { DEFAULT_TOKEN_STORE, type TokenStore } from './token-store.js';

// Coordination state of the process, keyed by the store object: mints in
// flight, the per-key store locks and the tokens refused by the API. The 429
// windows are keyed by token service and API key digest.
export let FLIGHTS = new WeakMap<TokenStore, Map<string, Promise<AccessToken>>>();
export let KEY_LOCKS = new WeakMap<TokenStore, Map<string, Promise<void>>>();
export let REFUSED = new WeakMap<TokenStore, Map<string, string>>();
export const RATE_LIMITS = new Map<string, number>();

export function mapFor<V>(registry: WeakMap<TokenStore, Map<string, V>>, store: TokenStore): Map<string, V> {
  let map = registry.get(store);
  if (!map) {
    map = new Map();
    registry.set(store, map);
  }
  return map;
}

/** Testing hooks of the token provider, passed through the client options under this symbol. */
export const TESTING = Symbol('didww.testing');

export interface TestingHooks {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** A monotonic clock in milliseconds. */
  now?: () => number;
  mintTimeoutMs?: number;
  storeTimeoutMs?: number;
}

/** Forgets every flight, store lock, refused token, 429 window and token of the default store (tests). */
export function resetAuthStateForTests(): void {
  FLIGHTS = new WeakMap();
  KEY_LOCKS = new WeakMap();
  REFUSED = new WeakMap();
  RATE_LIMITS.clear();
  DEFAULT_TOKEN_STORE.clear();
}
