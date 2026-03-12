import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';

describe('Pops', () => {
  it('lists pops', async () => {
    loadCassette('pops/list.yaml');
    const client = createTestClient();
    const result = await client.pops().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('pops');
    expect(result.data[0].name).toBeDefined();
  });
});
