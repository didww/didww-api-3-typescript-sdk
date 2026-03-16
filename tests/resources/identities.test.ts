import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';
import type { Address } from '../../src/resources/address.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('Identities', () => {
  describeOperationEnforcement({
    clientMethod: 'identities',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'identities',
  });
  it('lists identities', async () => {
    const client = setupClient('identities/list.yaml');
    const result = await client.identities().list();
    expect(result.data.length).toBeGreaterThan(0);
    const first = result.data[0];
    expect(first.firstName).toBe('John');
    expect(first.lastName).toBe('Doe');
    const country = first.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('United States');
    expect((country as Country).iso).toBe('US');
    expect(first.addresses).toBeDefined();
    expect(Array.isArray(first.addresses)).toBe(true);
    expect(first.addresses!.length).toBe(1);
    expect(isIncluded(first.addresses![0])).toBe(true);
    expect((first.addresses![0] as Address).cityName).toBe('Chicago');
    expect(first.proofs).toBeDefined();
    expect(first.proofs!.length).toBe(0);
    expect(first.permanentDocuments).toBeDefined();
    expect(first.permanentDocuments!.length).toBe(0);
  });

  it('creates an identity', async () => {
    const client = setupClient('identities/create.yaml');
    const result = await client.identities().create({
      firstName: 'John',
      lastName: 'Doe',
      identityType: 'Business',
      country: ref('countries', '7eda11bb-0e66-4146-98e7-57a5281f56c8'),
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.type).toBe('identities');
    const country = result.data.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('United States');
  });

  it('creates a personal identity', async () => {
    const client = setupClient('identities/create_1.yaml');
    const result = await client.identities().create({
      firstName: 'John',
      lastName: 'Doe',
      identityType: 'Personal',
      country: ref('countries', '7eda11bb-0e66-4146-98e7-57a5281f56c8'),
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.identityType).toBe('Personal');
    expect(result.data.companyName).toBeNull();
  });

  it('updates an identity', async () => {
    const client = setupClient('identities/update.yaml');
    const result = await client.identities().update({
      id: 'e96ae7d1-11d5-42bc-a5c5-211f3c3788ae',
      firstName: 'Jake',
      lastName: 'Johnson',
      companyName: 'Some Company Limited',
    });
    expect(result.data.id).toBe('e96ae7d1-11d5-42bc-a5c5-211f3c3788ae');
    expect(result.data.firstName).toBe('Jake');
    expect(result.data.lastName).toBe('Johnson');
    expect(result.data.companyName).toBe('Some Company Limited');
    expect(result.data.identityType).toBe('Business');
  });

  it('deletes an identity', async () => {
    const client = setupClient('identities/delete.yaml');
    await expect(client.identities().remove('e96ae7d1-11d5-42bc-a5c5-211f3c3788ae')).resolves.toBeUndefined();
  });
});
