import type { ResourceMeta, ResourceRef } from './base.js';
import type { IdentityType } from '../enums.js';

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
  country?: ResourceRef;
  proofs?: ResourceRef[];
  addresses?: ResourceRef[];
  permanentDocuments?: ResourceRef[];
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
}

export const IDENTITY_META: ResourceMeta<Identity, IdentityWrite> = {
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
  ],
};
