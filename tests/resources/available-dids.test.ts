import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('AvailableDids', () => {
  afterEach(() => cleanupNock());

  it('lists available DIDs', async () => {
    loadCassette('available_dids/list.yaml');
    const client = createTestClient();
    const result = await client.availableDids().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('available_dids');
    expect(result.data[0].number).toBeDefined();
  });

  it('finds an available DID', async () => {
    loadCassette('available_dids/show.yaml');
    const client = createTestClient();
    const result = await client.availableDids().find('0b76223b-9625-412f-b0f3-330551473e7e');
    expect(result.data.id).toBe('0b76223b-9625-412f-b0f3-330551473e7e');
    expect(result.data.number).toBe('16169886810');
  });
});
