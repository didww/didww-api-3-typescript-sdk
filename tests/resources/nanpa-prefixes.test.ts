import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';

describe('NanpaPrefixes', () => {
  afterEach(() => cleanupNock());

  it('lists NANPA prefixes', async () => {
    loadCassette('nanpa_prefixes/list.yaml');
    const client = createTestClient();
    const result = await client.nanpaPrefixes().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('nanpa_prefixes');
  });

  it('finds a NANPA prefix', async () => {
    loadCassette('nanpa_prefixes/show.yaml');
    const client = createTestClient();
    const result = await client.nanpaPrefixes().find('6c16d51d-d376-4395-91c4-012321317e48');
    expect(result.data.id).toBe('6c16d51d-d376-4395-91c4-012321317e48');
    expect(result.data.npa).toBe('864');
    expect(result.data.nxx).toBe('920');
    const country = result.data.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('United States');
    expect((country as Country).iso).toBe('US');
  });
});
