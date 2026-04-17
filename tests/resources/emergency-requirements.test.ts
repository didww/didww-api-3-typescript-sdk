import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('EmergencyRequirements', () => {
  describeOperationEnforcement({
    clientMethod: 'emergencyRequirements',
    allowedOperations: ['list', 'find'],
    resourceType: 'emergency_requirements',
  });

  it('lists emergency requirements', async () => {
    const client = setupClient('emergency_requirements/list.yaml');
    const result = await client.emergencyRequirements().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('emergency_requirements');
    expect(result.data[0].identityType).toBe('Personal');
    expect(result.data[0].addressMandatoryFields).toBeInstanceOf(Array);
    expect(result.data[0].personalMandatoryFields).toBeInstanceOf(Array);
    expect(result.data[0].businessMandatoryFields).toBeInstanceOf(Array);
  });

  it('finds an emergency requirement', async () => {
    const client = setupClient('emergency_requirements/show.yaml');
    const result = await client.emergencyRequirements().find('er-001');
    expect(result.data.id).toBe('er-001');
    expect(result.data.type).toBe('emergency_requirements');
    expect(result.data.estimateSetupTime).toBe(5);
    expect(result.data.requirementRestrictionMessage).toBeNull();
  });
});
