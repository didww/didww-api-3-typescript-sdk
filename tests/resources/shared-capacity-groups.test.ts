import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import type { CapacityPool } from '../../src/resources/capacity-pool.js';

describe('SharedCapacityGroups', () => {

  it('lists shared capacity groups', async () => {
    loadCassette('shared_capacity_groups/list.yaml');
    const client = createTestClient();
    const result = await client.sharedCapacityGroups().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('shared_capacity_groups');
  });

  it('finds a shared capacity group', async () => {
    loadCassette('shared_capacity_groups/show.yaml');
    const client = createTestClient();
    const result = await client.sharedCapacityGroups().find('89f987e2-0862-4bf4-a3f4-cdc89af0d875');
    expect(result.data.id).toBe('89f987e2-0862-4bf4-a3f4-cdc89af0d875');
    expect(result.data.name).toBe('didww');
    const pool = result.data.capacityPool;
    expect(pool).toBeDefined();
    expect(isIncluded(pool!)).toBe(true);
    expect((pool as CapacityPool).name).toBe('Standard');
    expect(result.data.dids).toBeDefined();
    expect(result.data.dids!.length).toBe(18);
    expect(isIncluded(result.data.dids![0])).toBe(true);
  });

  it('creates a shared capacity group', async () => {
    loadCassette('shared_capacity_groups/create_6.yaml');
    const client = createTestClient();
    const result = await client.sharedCapacityGroups().create({
      name: 'ts-sdk',
      sharedChannelsCount: 5,
      meteredChannelsCount: 0,
      capacityPool: ref('capacity_pools', 'b7522a31-4bf3-4c23-81e8-e7a14b23663f'),
    });
    expect(result.data.id).toBe('3688a9c3-354f-4e16-b458-1d2df9f02547');
    expect(result.data.name).toBe('ts-sdk');
    expect(result.data.sharedChannelsCount).toBe(5);
    expect(result.data.meteredChannelsCount).toBe(0);
  });

  it('updates a shared capacity group', async () => {
    loadCassette('shared_capacity_groups/update.yaml');
    const client = createTestClient();
    const result = await client.sharedCapacityGroups().update({
      id: '89f987e2-0862-4bf4-a3f4-cdc89af0d875',
      name: 'didww1',
      sharedChannelsCount: 10,
      meteredChannelsCount: 2,
    });
    expect(result.data.name).toBe('didww1');
    expect(result.data.sharedChannelsCount).toBe(10);
    expect(result.data.meteredChannelsCount).toBe(2);
  });

  it('deletes a shared capacity group', async () => {
    loadCassette('shared_capacity_groups/delete.yaml');
    const client = createTestClient();
    await expect(client.sharedCapacityGroups().remove('3688a9c3-354f-4e16-b458-1d2df9f02547')).resolves.toBeUndefined();
  });
});
