import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { ref } from '../../src/resources/base.js';

describe('Addresses', () => {
  afterEach(() => cleanupNock());

  it('creates an address', async () => {
    loadCassette('addresses/create.yaml');
    const client = createTestClient();
    const result = await client.addresses().create({
      cityName: 'New York',
      postalCode: '10001',
      address: '123 Main St',
      description: 'Test address',
      country: ref('countries', '7eda11bb-0e66-4146-98e7-57a5281f56c8'),
      identity: ref('identities', 'e96ae7d1-11d5-42bc-a5c5-211f3c3788ae'),
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.type).toBe('addresses');
  });

  it('deletes an address', async () => {
    loadCassette('addresses/delete.yaml');
    const client = createTestClient();
    await expect(client.addresses().remove('bf69bc70-e1c2-442c-9f30-335ee299b663')).resolves.toBeUndefined();
  });
});
