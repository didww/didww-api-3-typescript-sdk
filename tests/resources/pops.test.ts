import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';

describe('Pops', () => {
  it('lists pops', async () => {
    const client = setupClient('pops/list.yaml');
    const result = await client.pops().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('pops');
    expect(result.data[0].name).toBeDefined();
  });
});
