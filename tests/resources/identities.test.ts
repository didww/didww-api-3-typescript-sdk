import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { ref } from '../../src/resources/base.js';

describe('Identities', () => {
  afterEach(() => cleanupNock());

  it('creates an identity', async () => {
    loadCassette('identities/create.yaml');
    const client = createTestClient();
    const result = await client.identities().create({
      firstName: 'John',
      lastName: 'Doe',
      identityType: 'Business',
      country: ref('countries', '7eda11bb-0e66-4146-98e7-57a5281f56c8'),
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.type).toBe('identities');
  });

  it('deletes an identity', async () => {
    loadCassette('identities/delete.yaml');
    const client = createTestClient();
    await expect(client.identities().remove('e96ae7d1-11d5-42bc-a5c5-211f3c3788ae')).resolves.toBeUndefined();
  });
});
