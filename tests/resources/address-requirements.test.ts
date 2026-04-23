import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Country } from '../../src/resources/country.js';
import type { DidGroupType } from '../../src/resources/did-group-type.js';
import type { SupportingDocumentTemplate } from '../../src/resources/supporting-document-template.js';
import type { ProofType } from '../../src/resources/proof-type.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('AddressRequirements', () => {
  describeOperationEnforcement({
    clientMethod: 'addressRequirements',
    allowedOperations: ['list', 'find'],
    resourceType: 'address_requirements',
  });
  it('lists address requirements', async () => {
    const client = setupClient('address_requirements/list.yaml');
    const result = await client.addressRequirements().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('address_requirements');
  });

  it('finds an address requirement', async () => {
    const client = setupClient('address_requirements/show.yaml');
    const result = await client.addressRequirements().find('25d12afe-1ec6-4fe3-9621-b250dd1fb959');
    expect(result.data.id).toBe('25d12afe-1ec6-4fe3-9621-b250dd1fb959');
    expect(result.data.identityType).toBe('Any');
    const country = result.data.country;
    expect(country).toBeDefined();
    expect(isIncluded(country!)).toBe(true);
    expect((country as Country).name).toBe('Spain');
    expect((country as Country).iso).toBe('ES');
    const dgt = result.data.didGroupType;
    expect(dgt).toBeDefined();
    expect(isIncluded(dgt!)).toBe(true);
    expect((dgt as DidGroupType).name).toBe('Local');
    const personalPermanent = result.data.personalPermanentDocument;
    expect(personalPermanent).toBeDefined();
    expect(isIncluded(personalPermanent!)).toBe(true);
    expect((personalPermanent as SupportingDocumentTemplate).permanent).toBe(true);
    expect(result.data.personalProofTypes).toBeDefined();
    expect(result.data.personalProofTypes!.length).toBe(1);
    expect(isIncluded(result.data.personalProofTypes![0])).toBe(true);
    expect((result.data.personalProofTypes![0] as ProofType).name).toBe('Drivers License');
    expect(result.data.businessProofTypes).toBeDefined();
    expect(result.data.businessProofTypes!.length).toBe(7);
    expect(result.data.addressProofTypes).toBeDefined();
    expect(result.data.addressProofTypes!.length).toBe(1);
    expect((result.data.addressProofTypes![0] as ProofType).name).toBe('Copy of Phone Bill');
  });
});
