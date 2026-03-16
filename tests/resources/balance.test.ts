import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('Balance', () => {
  describeOperationEnforcement({
    clientMethod: 'balance',
    allowedOperations: ['find'],
    resourceType: 'balances',
    singleton: true,
  });
  it('finds balance', async () => {
    const client = setupClient('balance/list.yaml');
    const result = await client.balance().find();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('4c39e0bf-683b-4697-9322-5abaf4011883');
    expect(result.data.type).toBe('balances');
    expect(result.data.totalBalance).toBe('60.00');
    expect(result.data.credit).toBe('10.00');
    expect(result.data.balance).toBe('50.00');
  });
});
