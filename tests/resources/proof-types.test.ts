import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('ProofTypes', () => {
  afterEach(() => cleanupNock());

  it('lists proof types', async () => {
    loadCassette('proof_types/list.yaml');
    const client = createTestClient();
    const result = await client.proofTypes().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('proof_types');
    expect(result.data[0].name).toBeDefined();
  });
});
