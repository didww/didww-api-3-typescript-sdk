import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Countries', () => {
  afterEach(() => cleanupNock());

  it('lists countries', async () => {
    loadCassette('countries/list.yaml');
    const client = createTestClient();
    const result = await client.countries().list();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    const country = result.data[0];
    expect(country.id).toBeDefined();
    expect(country.type).toBe('countries');
    expect(country.name).toBeDefined();
  });

  it('finds a country', async () => {
    loadCassette('countries/show.yaml');
    const client = createTestClient();
    const result = await client.countries().find('7eda11bb-0e66-4146-98e7-57a5281f56c8');
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('7eda11bb-0e66-4146-98e7-57a5281f56c8');
    expect(result.data.type).toBe('countries');
    expect(result.data.name).toBe('United Kingdom');
    expect(result.data.prefix).toBe('44');
    expect(result.data.iso).toBe('GB');
  });
});
