import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';
import type { Region } from '../../src/resources/region.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('NanpaPrefixes', () => {
  describeOperationEnforcement({
    clientMethod: 'nanpaPrefixes',
    allowedOperations: ['list', 'find'],
    resourceType: 'nanpa_prefixes',
  });
  it('lists NANPA prefixes', async () => {
    const client = setupClient('nanpa_prefixes/list.yaml');
    const result = await client.nanpaPrefixes().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('nanpa_prefixes');
  });

  it('finds a NANPA prefix', async () => {
    const client = setupClient('nanpa_prefixes/show.yaml');
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

  it('finds a NANPA prefix with include=region', async () => {
    const client = setupClient('nanpa_prefixes/show_with_region.yaml');
    const result = await client.nanpaPrefixes().find('1e622e21-c740-4d3f-a615-2a7ef4991922', {
      include: 'region',
    });
    expect(result.data.id).toBe('1e622e21-c740-4d3f-a615-2a7ef4991922');
    expect(result.data.npa).toBe('201');
    expect(result.data.nxx).toBe('221');
    const region = result.data.region;
    expect(region).toBeDefined();
    expect(isIncluded(region!)).toBe(true);
    expect((region as Region).id).toBe('346e64c8-18c2-4a12-b1e2-20e090043fca');
    expect((region as Region).name).toBe('New Jersey');
    expect((region as Region).iso).toBe('US-NJ');
  });
});
