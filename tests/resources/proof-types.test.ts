import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';

describe('ProofTypes', () => {
  it('lists proof types', async () => {
    loadCassette('proof_types/list.yaml');
    const client = createTestClient();
    const result = await client.proofTypes().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('proof_types');
    expect(result.data[0].name).toBeDefined();
  });
});
