import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';

describe('Areas', () => {
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
    const country = result.data.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('Italy');
    expect((country as Country).iso).toBe('IT');
  });
});
