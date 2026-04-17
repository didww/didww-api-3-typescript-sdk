import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref } from '../../src/resources/base.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';
import { EmergencyVerificationStatus } from '../../src/enums.js';

describe('EmergencyVerifications', () => {
  describeOperationEnforcement({
    clientMethod: 'emergencyVerifications',
    allowedOperations: ['list', 'find', 'create', 'update'],
    resourceType: 'emergency_verifications',
  });

  it('lists emergency verifications', async () => {
    const client = setupClient('emergency_verifications/list.yaml');
    const result = await client.emergencyVerifications().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('emergency_verifications');
    expect(result.data[0].reference).toBe('EVR-123456');
    expect(result.data[0].status).toBe(EmergencyVerificationStatus.PENDING);
  });

  it('finds an emergency verification', async () => {
    const client = setupClient('emergency_verifications/show.yaml');
    const result = await client.emergencyVerifications().find('ev-001');
    expect(result.data.id).toBe('ev-001');
    expect(result.data.type).toBe('emergency_verifications');
    expect(result.data.status).toBe(EmergencyVerificationStatus.REJECTED);
    expect(result.data.rejectReasons).toBeInstanceOf(Array);
    expect(result.data.rejectReasons!.length).toBe(2);
    expect(result.data.rejectComment).toBe('Please re-submit with updated documentation.');
    expect(result.data.externalReferenceId).toBe('ref-xyz-999');
  });

  it('updates external_reference_id on an emergency verification', async () => {
    const client = setupClient('emergency_verifications/update.yaml');
    const result = await client.emergencyVerifications().update({
      id: 'ev-001',
      externalReferenceId: 'updated-ev-ref',
    });
    expect(result.data.id).toBe('ev-001');
    expect(result.data.externalReferenceId).toBe('updated-ev-ref');
  });

  it('creates an emergency verification', async () => {
    const client = setupClient('emergency_verifications/create.yaml');
    const result = await client.emergencyVerifications().create({
      callbackUrl: 'https://example.com/emergency/hook',
      callbackMethod: 'post',
      externalReferenceId: 'ref-abc-123',
      emergencyCallingService: ref('emergency_calling_services', 'ecs-001'),
      address: ref('addresses', 'addr-001'),
      dids: [ref('dids', 'did-001')],
    });
    expect(result.data.id).toBe('ev-new-001');
    expect(result.data.status).toBe(EmergencyVerificationStatus.PENDING);
    expect(result.data.callbackUrl).toBe('https://example.com/emergency/hook');
    expect(result.data.externalReferenceId).toBe('ref-abc-123');
  });
});
