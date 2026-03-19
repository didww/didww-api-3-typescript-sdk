import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Region } from '../../src/resources/region.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('Countries', () => {
  describeOperationEnforcement({
    clientMethod: 'countries',
    allowedOperations: ['list', 'find'],
    resourceType: 'countries',
  });
  it('lists countries', async () => {
    const client = setupClient('countries/list.yaml');
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
    const client = setupClient('countries/show.yaml');
    const result = await client.countries().find('7eda11bb-0e66-4146-98e7-57a5281f56c8');
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('7eda11bb-0e66-4146-98e7-57a5281f56c8');
    expect(result.data.type).toBe('countries');
    expect(result.data.name).toBe('United Kingdom');
    expect(result.data.prefix).toBe('44');
    expect(result.data.iso).toBe('GB');
  });

  it('finds a country with regions', async () => {
    const client = setupClient('countries/show_with_regions.yaml');
    const result = await client.countries().find('661d8448-8897-4765-acda-00cc1740148d', {
      include: 'regions',
    });
    expect(result.data.name).toBe('Lithuania');
    expect(result.data.prefix).toBe('370');
    expect(result.data.iso).toBe('LT');
    expect(result.data.regions).toBeDefined();
    expect(Array.isArray(result.data.regions)).toBe(true);
    expect(result.data.regions!.length).toBe(10);
    const regionNames = result.data.regions!.filter(isIncluded).map((r: Region) => r.name);
    expect(regionNames).toContain('Vilniaus Apskritis');
    expect(regionNames).toContain('Kauno Apskritis');
  });
});
