import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('Areas', () => {
  describeOperationEnforcement({
    clientMethod: 'areas',
    allowedOperations: ['list', 'find'],
    resourceType: 'areas',
  });
  it('lists areas', async () => {
    const client = setupClient('areas/list.yaml');
    const result = await client.areas().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('areas');
  });

  it('finds an area', async () => {
    const client = setupClient('areas/show.yaml');
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
