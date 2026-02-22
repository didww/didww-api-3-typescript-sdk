import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Dids', () => {
  afterEach(() => cleanupNock());

  it('lists DIDs', async () => {
    loadCassette('dids/list.yaml');
    const client = createTestClient();
    const result = await client.dids().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('dids');
    expect(result.data[0].number).toBeDefined();
  });

  it('finds a DID', async () => {
    loadCassette('dids/show.yaml');
    const client = createTestClient();
    const result = await client.dids().find('9df99644-f1a5-4a3c-99a4-559d758eb96b');
    expect(result.data.id).toBe('9df99644-f1a5-4a3c-99a4-559d758eb96b');
    expect(result.data.number).toBe('16091609123456797');
  });
});
