import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';
import type { City } from '../../src/resources/city.js';
import type { DidGroupType } from '../../src/resources/did-group-type.js';
import type { StockKeepingUnit } from '../../src/resources/stock-keeping-unit.js';

describe('DidGroups', () => {
  afterEach(() => cleanupNock());

  it('lists DID groups', async () => {
    loadCassette('did_groups/list.yaml');
    const client = createTestClient();
    const result = await client.didGroups().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('did_groups');
  });

  it('finds a DID group', async () => {
    loadCassette('did_groups/show.yaml');
    const client = createTestClient();
    const result = await client.didGroups().find('2187c36d-28fb-436f-8861-5a0f5b5a3ee1');
    expect(result.data.id).toBe('2187c36d-28fb-436f-8861-5a0f5b5a3ee1');
    expect(result.data.prefix).toBe('241');
    expect(result.data.areaName).toBe('Aachen');
    const country = result.data.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('Germany');
    expect((country as Country).iso).toBe('DE');
    const city = result.data.city;
    expect(city).toBeDefined();
    expect(isIncluded(city!)).toBe(true);
    expect((city as City).name).toBe('Aachen');
    const dgt = result.data.didGroupType;
    expect(dgt).toBeDefined();
    expect(isIncluded(dgt!)).toBe(true);
    expect((dgt as DidGroupType).name).toBe('Local');
    expect(result.data.stockKeepingUnits).toBeDefined();
    expect(result.data.stockKeepingUnits!.length).toBe(2);
    expect(isIncluded(result.data.stockKeepingUnits![0])).toBe(true);
    expect((result.data.stockKeepingUnits![0] as StockKeepingUnit).setupPrice).toBe('0.4');
  });
});
