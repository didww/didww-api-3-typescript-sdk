import { defineResource, type ResourceRef } from './base.js';
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

export const IDENTITY_RESOURCE = defineResource<Identity, IdentityWrite>()({
  type: 'identities',
  path: 'identities',
  writableKeys: [
    'firstName',
    'lastName',
    'phoneNumber',
    'idNumber',
    'birthDate',
    'companyName',
    'companyRegNumber',
    'vatId',
    'description',
    'personalTaxId',
    'identityType',
    'externalReferenceId',
    'contactEmail',
    'country',
    'birthCountry',
  ],
  relationshipKeys: ['country', 'birthCountry'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
