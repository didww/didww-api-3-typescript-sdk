import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('PublicKeys', () => {
  describeOperationEnforcement({
    clientMethod: 'publicKeys',
    allowedOperations: ['list', 'find'],
    resourceType: 'public_keys',
  });
  it('lists public keys', async () => {
    const client = setupClient('public_keys/list.yaml');
    const result = await client.publicKeys().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('public_keys');
    expect(result.data[0].key).toBeDefined();
  });
});
