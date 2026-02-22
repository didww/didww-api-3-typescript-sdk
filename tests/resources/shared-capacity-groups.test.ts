import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('SharedCapacityGroups', () => {
  afterEach(() => cleanupNock());

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
  });

  it('updates a shared capacity group', async () => {
    loadCassette('shared_capacity_groups/update.yaml');
    const client = createTestClient();
    const result = await client.sharedCapacityGroups().update({
      id: '89f987e2-0862-4bf4-a3f4-cdc89af0d875',
      name: 'didww1',
      shared_channels_count: 10,
      metered_channels_count: 2,
    });
    expect(result.data.name).toBe('didww1');
    expect(result.data.shared_channels_count).toBe(10);
    expect(result.data.metered_channels_count).toBe(2);
  });

  it('deletes a shared capacity group', async () => {
    loadCassette('shared_capacity_groups/delete.yaml');
    const client = createTestClient();
    await expect(client.sharedCapacityGroups().remove('3688a9c3-354f-4e16-b458-1d2df9f02547')).resolves.toBeUndefined();
  });
});
