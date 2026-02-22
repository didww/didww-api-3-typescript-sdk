import { DidwwClient } from '../../src/client.js';
import { Environment } from '../../src/configuration.js';

export const TEST_API_KEY = 'test-api-key';

export function createTestClient(): DidwwClient {
  return new DidwwClient({
    apiKey: TEST_API_KEY,
    environment: Environment.SANDBOX,
  });
}
