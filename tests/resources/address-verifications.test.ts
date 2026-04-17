import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import type { Did } from '../../src/resources/did.js';
import type { Address } from '../../src/resources/address.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('AddressVerifications', () => {
  describeOperationEnforcement({
    clientMethod: 'addressVerifications',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'address_verifications',
  });
  it('lists address verifications', async () => {
    const client = setupClient('address_verifications/list.yaml');
    const result = await client.addressVerifications().list();
    expect(result.data.length).toBeGreaterThan(0);
    const first = result.data[0];
    expect(first.status).toBe('Pending');
    expect(first.dids).toBeDefined();
    expect(Array.isArray(first.dids)).toBe(true);
    expect(first.dids!.length).toBe(1);
    expect(isIncluded(first.dids![0])).toBe(true);
    expect((first.dids![0] as Did).number).toBe('13472013835');
    const address = first.address;
    expect(address).toBeDefined();
    expect(isIncluded(address!)).toBe(true);
    expect((address as Address).cityName).toBe('Chicago');
  });

  it('finds an address verification', async () => {
    const client = setupClient('address_verifications/show.yaml');
    const result = await client.addressVerifications().find('c8e004b0-87ec-4987-b4fb-ee89db099f0e');
    expect(result.data.id).toBe('c8e004b0-87ec-4987-b4fb-ee89db099f0e');
    expect(result.data.status).toBe('Approved');
    expect(result.data.rejectReasons).toBeNull();
  });

  it('finds a rejected address verification with reject_reasons array', async () => {
    const client = setupClient('address_verifications/show_rejected.yaml');
    const result = await client.addressVerifications().find('4bba99df-d9cc-48ab-a28a-9ff442bfd056');
    expect(result.data.id).toBe('4bba99df-d9cc-48ab-a28a-9ff442bfd056');
    expect(result.data.status).toBe('Rejected');
    expect(result.data.rejectReasons).toEqual(['Building/house/apartment number is missing']);
    expect(result.data.rejectComment).toBe('Please re-submit with a more recent utility bill.');
    expect(result.data.externalReferenceId).toBe('crm-verif-0001');
  });

  it('updates external_reference_id on an address verification', async () => {
    const client = setupClient('address_verifications/update.yaml');
    const result = await client.addressVerifications().update({
      id: '429e6d4e-2ee9-4953-aa98-0b3ac07f0f96',
      externalReferenceId: 'updated-ref-42',
    });
    expect(result.data.id).toBe('429e6d4e-2ee9-4953-aa98-0b3ac07f0f96');
    expect(result.data.externalReferenceId).toBe('updated-ref-42');
  });

  it('creates an address verification', async () => {
    const client = setupClient('address_verifications/create.yaml');
    const result = await client.addressVerifications().create({
      serviceDescription: 'Test service',
      address: ref('addresses', 'bf69bc70-e1c2-442c-9f30-335ee299b663'),
      dids: [ref('dids', '9df99644-f1a5-4a3c-99a4-559d758eb96b')],
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.status).toBe('Pending');
    const addr = result.data.address;
    expect(addr).toBeDefined();
    expect(isIncluded(addr!)).toBe(true);
    expect((addr as Address).cityName).toBe('Chicago');
  });
});
