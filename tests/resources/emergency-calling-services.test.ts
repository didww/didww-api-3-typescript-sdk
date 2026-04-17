import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Address } from '../../src/resources/address.js';
import type { EmergencyRequirement } from '../../src/resources/emergency-requirement.js';
import type { EmergencyVerification } from '../../src/resources/emergency-verification.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';
import { EmergencyCallingServiceStatus } from '../../src/enums.js';

describe('EmergencyCallingServices', () => {
  describeOperationEnforcement({
    clientMethod: 'emergencyCallingServices',
    allowedOperations: ['list', 'find', 'remove'],
    resourceType: 'emergency_calling_services',
  });

  it('lists emergency calling services', async () => {
    const client = setupClient('emergency_calling_services/list.yaml');
    const result = await client.emergencyCallingServices().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('emergency_calling_services');
    expect(result.data[0].name).toBe('Emergency US');
    expect(result.data[0].status).toBe(EmergencyCallingServiceStatus.ACTIVE);
    expect(result.data[0].reference).toBe('ECS-123456');
    expect(result.data[0].createdAt).toBe('2026-03-15T08:00:00.000Z');
  });

  it('finds an emergency calling service', async () => {
    const client = setupClient('emergency_calling_services/show.yaml');
    const result = await client.emergencyCallingServices().find('ecs-001');
    expect(result.data.id).toBe('ecs-001');
    expect(result.data.type).toBe('emergency_calling_services');
    expect(result.data.name).toBe('Emergency US');
    expect(result.data.status).toBe(EmergencyCallingServiceStatus.ACTIVE);
    expect(result.data.renewDate).toBe('2026-05-01T00:00:00.000Z');
  });

  it('finds an emergency calling service with included address', async () => {
    const client = setupClient('emergency_calling_services/show_with_address.yaml');
    const result = await client.emergencyCallingServices().find('01234567-89ab-cdef-0123-456789abcdef', {
      include: ['address'],
    });
    expect(result.data.address).toBeDefined();
    expect(isIncluded(result.data.address!)).toBe(true);
    expect((result.data.address as Address).cityName).toBe('Berlin');
  });

  it('finds an emergency calling service with included emergency_requirement and emergency_verification', async () => {
    const client = setupClient('emergency_calling_services/show_with_includes.yaml');
    const result = await client.emergencyCallingServices().find('ecs-001', {
      include: ['emergencyRequirement', 'emergencyVerification'],
    });
    expect(result.data.emergencyRequirement).toBeDefined();
    expect(isIncluded(result.data.emergencyRequirement!)).toBe(true);
    expect((result.data.emergencyRequirement as EmergencyRequirement).identityType).toBe('personal');
    expect(result.data.emergencyVerification).toBeDefined();
    expect(isIncluded(result.data.emergencyVerification!)).toBe(true);
    expect((result.data.emergencyVerification as EmergencyVerification).reference).toBe('EVR-123456');
    expect((result.data.emergencyVerification as EmergencyVerification).status).toBe('approved');
  });

  it('deletes an emergency calling service', async () => {
    const client = setupClient('emergency_calling_services/delete.yaml');
    await expect(client.emergencyCallingServices().remove('ecs-001')).resolves.toBeUndefined();
  });
});
