import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Pops', () => {
  afterEach(() => cleanupNock());

  it('lists pops', async () => {
    loadCassette('pops/list.yaml');
    const client = createTestClient();
    const result = await client.pops().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('pops');
    expect(result.data[0].name).toBeDefined();
  });
});
