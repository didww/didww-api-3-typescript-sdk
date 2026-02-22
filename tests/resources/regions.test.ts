import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Regions', () => {
  afterEach(() => cleanupNock());

  it('lists regions', async () => {
    loadCassette('regions/list.yaml');
    const client = createTestClient();
    const result = await client.regions().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('regions');
    expect(result.data[0].name).toBe('Alabama');
  });

  it('finds a region', async () => {
    loadCassette('regions/show.yaml');
    const client = createTestClient();
    const result = await client.regions().find('c11b1f34-16cf-4ba6-8497-f305b53d5b01');
    expect(result.data.id).toBe('c11b1f34-16cf-4ba6-8497-f305b53d5b01');
    expect(result.data.name).toBe('California');
  });
});
