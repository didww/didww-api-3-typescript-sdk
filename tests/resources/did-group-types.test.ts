import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('DidGroupTypes', () => {
  afterEach(() => cleanupNock());

  it('lists DID group types', async () => {
    loadCassette('did_group_types/list.yaml');
    const client = createTestClient();
    const result = await client.didGroupTypes().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('did_group_types');
  });

  it('finds a DID group type', async () => {
    loadCassette('did_group_types/show.yaml');
    const client = createTestClient();
    const result = await client.didGroupTypes().find('d6530a8c-924c-469a-98c0-9525602e6192');
    expect(result.data.id).toBe('d6530a8c-924c-469a-98c0-9525602e6192');
    expect(result.data.name).toBe('Global');
  });
});
