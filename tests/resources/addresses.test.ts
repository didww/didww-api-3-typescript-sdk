import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import type { Identity } from '../../src/resources/identity.js';
import type { Country } from '../../src/resources/country.js';

describe('Addresses', () => {

  it('lists addresses', async () => {
    loadCassette('addresses/list.yaml');
    const client = createTestClient();
    const result = await client.addresses().list();
    expect(result.data.length).toBeGreaterThan(0);
    const first = result.data[0];
    expect(first.cityName).toBe('Odessa');
    const identity = first.identity;
    expect(identity).toBeDefined();
    expect(isIncluded(identity!)).toBe(true);
    expect((identity as Identity).firstName).toBe('John');
    expect((identity as Identity).lastName).toBe('Doe');
    const country = first.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('Ukraine');
    expect(first.proofs).toBeDefined();
    expect(Array.isArray(first.proofs)).toBe(true);
    expect(first.proofs!.length).toBe(1);
  });

  it('creates an address', async () => {
    loadCassette('addresses/create.yaml');
    const client = createTestClient();
    const result = await client.addresses().create({
      cityName: 'New York',
      postalCode: '10001',
      address: '123 Main St',
      description: 'Test address',
      country: ref('countries', '7eda11bb-0e66-4146-98e7-57a5281f56c8'),
      identity: ref('identities', 'e96ae7d1-11d5-42bc-a5c5-211f3c3788ae'),
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.type).toBe('addresses');
    const country = result.data.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('United States');
  });

  it('updates an address', async () => {
    loadCassette('addresses/update.yaml');
    const client = createTestClient();
    const result = await client.addresses().update({
      id: 'bf69bc70-e1c2-442c-9f30-335ee299b663',
      cityName: 'Chicago',
      postalCode: '1234',
      address: 'Main street',
      description: 'some address',
    });
    expect(result.data.id).toBe('bf69bc70-e1c2-442c-9f30-335ee299b663');
    expect(result.data.cityName).toBe('Chicago');
    expect(result.data.postalCode).toBe('1234');
    expect(result.data.address).toBe('Main street');
    expect(result.data.description).toBe('some address');
  });

  it('deletes an address', async () => {
    loadCassette('addresses/delete.yaml');
    const client = createTestClient();
    await expect(client.addresses().remove('bf69bc70-e1c2-442c-9f30-335ee299b663')).resolves.toBeUndefined();
  });
});
