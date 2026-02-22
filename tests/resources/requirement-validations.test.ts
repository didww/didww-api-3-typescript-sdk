import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { DidwwApiError } from '../../src/errors.js';
import { ref } from '../../src/resources/base.js';

describe('RequirementValidations', () => {
  afterEach(() => cleanupNock());

  it('creates a requirement validation', async () => {
    loadCassette('requirement_validations/create.yaml');
    const client = createTestClient();
    const result = await client.requirementValidations().create({
      address: ref('addresses', 'd3414687-40f4-4346-a267-c2c65117d28c'),
      requirement: ref('requirements', 'aea92b24-a044-4864-9740-89d3e15b65c7'),
    });
    expect(result.data.id).toBe('aea92b24-a044-4864-9740-89d3e15b65c7');
  });

  it('handles validation failure with 422', async () => {
    loadCassette('requirement_validations/create_1.yaml');
    const client = createTestClient();
    try {
      await client.requirementValidations().create({
        identity: ref('identities', '5e9df058-50d2-4e34-b0d4-d1746b86f41a'),
        address: ref('addresses', 'd3414687-40f4-4346-a267-c2c65117d28c'),
        requirement: ref('requirements', '2efc3427-8ba6-4d50-875d-f2de4a068de8'),
      });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DidwwApiError);
      const apiError = err as DidwwApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.errors.length).toBe(3);
    }
  });
});
