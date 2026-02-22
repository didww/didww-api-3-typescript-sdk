import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Cities', () => {
  afterEach(() => cleanupNock());

  it('lists cities', async () => {
    loadCassette('cities/list.yaml');
    const client = createTestClient();
    const result = await client.cities().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('cities');
    expect(result.data[0].name).toBe('Aachen');
  });

  it('finds a city', async () => {
    loadCassette('cities/show.yaml');
    const client = createTestClient();
    const result = await client.cities().find('368bf92f-c36e-473f-96fc-d53ed1b4028b');
    expect(result.data.id).toBe('368bf92f-c36e-473f-96fc-d53ed1b4028b');
    expect(result.data.name).toBe('New York');
  });
});
