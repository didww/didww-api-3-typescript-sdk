import type { AccessToken } from './access-token.js';
import { DEFAULT_TOKEN_STORE, type TokenStore } from './token-store.js';

// Coordination state of the process, keyed by the store object: mints in
// flight, the per-key store locks and the tokens refused by the API. The 429
// windows are keyed by token service and API key digest.
interface AuthState {
  flights: WeakMap<TokenStore, Map<string, Promise<AccessToken>>>;
  keyLocks: WeakMap<TokenStore, Map<string, Promise<void>>>;
  refused: WeakMap<TokenStore, Map<string, string>>;
  rateLimits: Map<string, number>;
}

function emptyAuthState(): AuthState {
  return { flights: new WeakMap(), keyLocks: new WeakMap(), refused: new WeakMap(), rateLimits: new Map() };
}

export const AUTH_STATE: AuthState = emptyAuthState();

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
  Object.assign(AUTH_STATE, emptyAuthState());
  DEFAULT_TOKEN_STORE.clear();
}
