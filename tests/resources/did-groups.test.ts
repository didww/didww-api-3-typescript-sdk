import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

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
  });
});
