import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref } from '../../src/resources/base.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('EmergencyRequirementValidations', () => {
  describeOperationEnforcement({
    clientMethod: 'emergencyRequirementValidations',
    allowedOperations: ['create'],
    resourceType: 'emergency_requirement_validations',
  });

  it('creates an emergency requirement validation', async () => {
    const client = setupClient('emergency_requirement_validations/create.yaml');
    const result = await client.emergencyRequirementValidations().create({
      emergencyRequirement: ref('emergency_requirements', 'b4ca7d30-7393-44c1-9509-40d89d2d8005'),
      address: ref('addresses', 'a8adc376-ff24-46f4-bf80-8d408771a4d9'),
      identity: ref('identities', '84578a0b-be5b-446a-9cd8-b56122c5be7f'),
    });
    expect(result.data.id).toBe('b4ca7d30-7393-44c1-9509-40d89d2d8005');
    expect(result.data.type).toBe('emergency_requirement_validations');
  });
});
