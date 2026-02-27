import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';
import type { Region } from '../../src/resources/region.js';

describe('Cities', () => {
  afterEach(() => cleanupNock());

  it('lists cities', async () => {
    loadCassette('cities/list.yaml');
    const client = createTestClient();
    const result = await client.cities().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('cities');
    expect(result.data[0].name).toBe('Aachen');
  });

  it('finds a city', async () => {
    loadCassette('cities/show.yaml');
    const client = createTestClient();
    const result = await client.cities().find('368bf92f-c36e-473f-96fc-d53ed1b4028b');
    expect(result.data.id).toBe('368bf92f-c36e-473f-96fc-d53ed1b4028b');
    expect(result.data.name).toBe('New York');
    const country = result.data.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('United States');
    const region = result.data.region;
    expect(region).toBeDefined();
    expect(isIncluded(region!)).toBe(true);
    expect((region as Region).name).toBe('New York');
    expect(result.data.area).toBeUndefined();
  });
});
