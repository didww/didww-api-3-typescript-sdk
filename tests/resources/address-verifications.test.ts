import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { ref } from '../../src/resources/base.js';

describe('AddressVerifications', () => {
  afterEach(() => cleanupNock());

  it('finds an address verification', async () => {
    loadCassette('address_verifications/show.yaml');
    const client = createTestClient();
    const result = await client.addressVerifications().find('c8e004b0-87ec-4987-b4fb-ee89db099f0e');
    expect(result.data.id).toBe('c8e004b0-87ec-4987-b4fb-ee89db099f0e');
    expect(result.data.status).toBe('Approved');
  });

  it('creates an address verification', async () => {
    loadCassette('address_verifications/create.yaml');
    const client = createTestClient();
    const result = await client.addressVerifications().create({
      service_description: 'Test service',
      address: ref('addresses', 'bf69bc70-e1c2-442c-9f30-335ee299b663'),
      dids: [ref('dids', '9df99644-f1a5-4a3c-99a4-559d758eb96b')],
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.status).toBe('Pending');
  });
});
