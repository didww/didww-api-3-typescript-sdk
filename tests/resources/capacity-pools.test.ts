import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

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
  });

  it('updates a capacity pool', async () => {
    loadCassette('capacity_pools/update.yaml');
    const client = createTestClient();
    const result = await client.capacityPools().update({
      id: 'f288d07c-e2fc-4ae6-9837-b18fb469c324',
      total_channels_count: 25,
    });
    expect(result.data.id).toBe('f288d07c-e2fc-4ae6-9837-b18fb469c324');
    expect(result.data.name).toBe('Standard');
    expect(result.data.total_channels_count).toBe(25);
    expect(result.data.assigned_channels_count).toBe(24);
  });
});
