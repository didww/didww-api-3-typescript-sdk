import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Requirements', () => {
  afterEach(() => cleanupNock());

  it('lists requirements', async () => {
    loadCassette('requirements/list.yaml');
    const client = createTestClient();
    const result = await client.requirements().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('requirements');
  });

  it('finds a requirement', async () => {
    loadCassette('requirements/show.yaml');
    const client = createTestClient();
    const result = await client.requirements().find('25d12afe-1ec6-4fe3-9621-b250dd1fb959');
    expect(result.data.id).toBe('25d12afe-1ec6-4fe3-9621-b250dd1fb959');
    expect(result.data.identity_type).toBe('Any');
  });
});
