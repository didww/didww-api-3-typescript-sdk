import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';

describe('ProofTypes', () => {
  it('lists proof types', async () => {
    const client = setupClient('proof_types/list.yaml');
    const result = await client.proofTypes().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('proof_types');
    expect(result.data[0].name).toBeDefined();
  });
});
