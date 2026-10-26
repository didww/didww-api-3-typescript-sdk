import { DidwwClient, type DidwwClientOptions } from '../../src/client.js';
import { Audience, DEFAULT_API_VERSION, Environment } from '../../src/configuration.js';
import { AccessToken } from '../../src/auth/access-token.js';
import type { TokenStore } from '../../src/auth/token-store.js';
import { loadCassette } from './vcr.js';

export const TEST_API_KEY = 'test-api-key';
export const TEST_ACCESS_TOKEN = 'test-access-token';

/** A store that already holds a token for every audience, so cassette tests never ask the token service. */
export function seededTokenStore(accessToken: string = TEST_ACCESS_TOKEN): TokenStore {
  const token = new AccessToken({
    accessToken,
    expiresIn: 3600,
    aud: Object.values(Audience),
    apiVersion: DEFAULT_API_VERSION,
  });
  return {
    get: () => token,
    set: () => undefined,
    delete: () => undefined,
  };
}

export function createTestClient(options: Partial<DidwwClientOptions> = {}): DidwwClient {
  return new DidwwClient({
    apiKey: TEST_API_KEY,
    environment: Environment.SANDBOX,
    tokenStore: seededTokenStore(),
    ...options,
  });
}

export function setupClient(cassette: string): DidwwClient {
  loadCassette(cassette);
  return createTestClient();
}
