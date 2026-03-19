import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('ProofTypes', () => {
  describeOperationEnforcement({
    clientMethod: 'proofTypes',
    allowedOperations: ['list', 'find'],
    resourceType: 'proof_types',
  });
  it('lists proof types', async () => {
    const client = setupClient('proof_types/list.yaml');
    const result = await client.proofTypes().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('proof_types');
    expect(result.data[0].name).toBeDefined();
  });
});
