import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { DidwwApiError } from '../../src/errors.js';
import { ref } from '../../src/resources/base.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('RequirementValidations', () => {
  describeOperationEnforcement({
    clientMethod: 'requirementValidations',
    allowedOperations: ['list', 'find', 'create', 'remove'],
    resourceType: 'requirement_validations',
  });
  it('creates a requirement validation', async () => {
    const client = setupClient('requirement_validations/create.yaml');
    const result = await client.requirementValidations().create({
      address: ref('addresses', 'd3414687-40f4-4346-a267-c2c65117d28c'),
      requirement: ref('requirements', 'aea92b24-a044-4864-9740-89d3e15b65c7'),
    });
    expect(result.data.id).toBe('aea92b24-a044-4864-9740-89d3e15b65c7');
  });

  it('handles validation failure with 422', async () => {
    const client = setupClient('requirement_validations/create_1.yaml');
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
