import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';

describe('Balance', () => {
  it('finds balance', async () => {
    loadCassette('balance/list.yaml');
    const client = createTestClient();
    const result = await client.balance().find();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('4c39e0bf-683b-4697-9322-5abaf4011883');
    expect(result.data.type).toBe('balances');
    expect(result.data.totalBalance).toBe('60.00');
    expect(result.data.credit).toBe('10.00');
    expect(result.data.balance).toBe('50.00');
  });
});
