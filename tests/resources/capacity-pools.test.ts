import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';
import type { SharedCapacityGroup } from '../../src/resources/shared-capacity-group.js';
import type { QtyBasedPricing } from '../../src/resources/qty-based-pricing.js';

describe('CapacityPools', () => {
  afterEach(() => cleanupNock());

  it('lists capacity pools', async () => {
    loadCassette('capacity_pools/list.yaml');
    const client = createTestClient();
    const result = await client.capacityPools().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('capacity_pools');
  });

  it('finds a capacity pool', async () => {
    loadCassette('capacity_pools/show.yaml');
    const client = createTestClient();
    const result = await client.capacityPools().find('f288d07c-e2fc-4ae6-9837-b18fb469c324');
    expect(result.data.id).toBe('f288d07c-e2fc-4ae6-9837-b18fb469c324');
    expect(result.data.name).toBe('Standard');
    expect(result.data.countries).toBeDefined();
    expect(result.data.countries!.length).toBe(53);
    const usCountry = result.data.countries!.find((c) => isIncluded(c) && (c as Country).iso === 'US') as Country;
    expect(usCountry).toBeDefined();
    expect(usCountry.name).toBe('United States');
    expect(result.data.sharedCapacityGroups).toBeDefined();
    expect(result.data.sharedCapacityGroups!.length).toBe(3);
    expect(isIncluded(result.data.sharedCapacityGroups![0])).toBe(true);
    expect((result.data.sharedCapacityGroups![0] as SharedCapacityGroup).name).toBe('test');
    expect(result.data.qtyBasedPricings).toBeDefined();
    expect(result.data.qtyBasedPricings!.length).toBe(3);
    expect(isIncluded(result.data.qtyBasedPricings![0])).toBe(true);
    expect((result.data.qtyBasedPricings![0] as QtyBasedPricing).qty).toBe(30);
  });

  it('updates a capacity pool', async () => {
    loadCassette('capacity_pools/update.yaml');
    const client = createTestClient();
    const result = await client.capacityPools().update({
      id: 'f288d07c-e2fc-4ae6-9837-b18fb469c324',
      totalChannelsCount: 25,
    });
    expect(result.data.id).toBe('f288d07c-e2fc-4ae6-9837-b18fb469c324');
    expect(result.data.name).toBe('Standard');
    expect(result.data.totalChannelsCount).toBe(25);
    expect(result.data.assignedChannelsCount).toBe(24);
  });
});
