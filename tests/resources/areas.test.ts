import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Areas', () => {
  afterEach(() => cleanupNock());

  it('lists areas', async () => {
    loadCassette('areas/list.yaml');
    const client = createTestClient();
    const result = await client.areas().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('areas');
  });

  it('finds an area', async () => {
    loadCassette('areas/show.yaml');
    const client = createTestClient();
    const result = await client.areas().find('ab2adc18-7c94-42d9-bdde-b28dfc373a22');
    expect(result.data.id).toBe('ab2adc18-7c94-42d9-bdde-b28dfc373a22');
    expect(result.data.name).toBe('Tuscany');
  });
});
