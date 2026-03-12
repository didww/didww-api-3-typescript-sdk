import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';

describe('PublicKeys', () => {
  it('lists public keys', async () => {
    loadCassette('public_keys/list.yaml');
    const client = createTestClient();
    const result = await client.publicKeys().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('public_keys');
    expect(result.data[0].key).toBeDefined();
  });
});
