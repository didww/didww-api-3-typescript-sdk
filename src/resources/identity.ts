import { defineResource, type ResourceRef } from './base.js';
import { filterWritableKeys } from '../filter-writable-keys.js';
import type { IdentityType } from '../enums.js';
import type { Country } from './country.js';
import type { Proof } from './proof.js';
import type { Address } from './address.js';
import type { PermanentSupportingDocument } from './permanent-supporting-document.js';

export interface Identity {
  id: string;
  type: 'identities';
  firstName: string;
  lastName: string;
  phoneNumber: string;
  idNumber: string;
  birthDate: string | null;
  companyName: string;
  companyWebsite: string | null;
  companyRegNumber: string;
  vatId: string;
  description: string;
  personalTaxId: string;
  identityType: IdentityType;
  externalReferenceId: string;
  contactEmail: string;
  createdAt: string;
  verified: boolean;
  country?: Country | ResourceRef;
  birthCountry?: Country | ResourceRef;
  proofs?: (Proof | ResourceRef)[];
  addresses?: (Address | ResourceRef)[];
  permanentDocuments?: (PermanentSupportingDocument | ResourceRef)[];
}

export interface IdentityWrite {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  idNumber?: string;
  birthDate?: string | null;
  companyName?: string;
  /** `null` clears it on update; on create a null is not sent. */
  companyWebsite?: string | null;
  companyRegNumber?: string;
  vatId?: string;
  description?: string;
  personalTaxId?: string;
  identityType?: IdentityType;
  externalReferenceId?: string;
  contactEmail?: string;
  country?: ResourceRef;
  birthCountry?: ResourceRef;
}

const WRITABLE_KEYS = [
  'firstName',
  'lastName',
  'phoneNumber',
  'idNumber',
  'birthDate',
  'companyName',
  'companyWebsite',
  'companyRegNumber',
  'vatId',
  'description',
  'personalTaxId',
  'identityType',
  'externalReferenceId',
  'contactEmail',
  'country',
  'birthCountry',
] as const satisfies readonly (keyof IdentityWrite)[];

export const IDENTITY_RESOURCE = defineResource<Identity, IdentityWrite>()({
  type: 'identities',
  path: 'identities',
  writableKeys: WRITABLE_KEYS,
  relationshipKeys: ['country', 'birthCountry'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
  serializeCustom(data, method) {
    const result = filterWritableKeys(data, WRITABLE_KEYS);
    // A null website is left out of a create request.
    if (method === 'POST' && result.companyWebsite === null) delete result.companyWebsite;
    return result;
  },
});
