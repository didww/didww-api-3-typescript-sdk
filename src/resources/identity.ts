import type { ResourceMeta, ResourceRef } from './base.js';
import type { IdentityType } from '../enums.js';

export interface Identity {
  id: string;
  type: 'identities';
  first_name: string;
  last_name: string;
  phone_number: string;
  id_number: string;
  birth_date: string | null;
  company_name: string;
  company_reg_number: string;
  vat_id: string;
  description: string;
  personal_tax_id: string;
  identity_type: IdentityType;
  external_reference_id: string;
  contact_email: string;
  created_at: string;
  verified: boolean;
  country?: ResourceRef;
  proofs?: ResourceRef[];
  addresses?: ResourceRef[];
  permanent_documents?: ResourceRef[];
}

export interface IdentityWrite {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  id_number?: string;
  birth_date?: string | null;
  company_name?: string;
  company_reg_number?: string;
  vat_id?: string;
  description?: string;
  personal_tax_id?: string;
  identity_type?: IdentityType;
  external_reference_id?: string;
  contact_email?: string;
  country?: ResourceRef;
}

export const IDENTITY_META: ResourceMeta<Identity, IdentityWrite> = {
  type: 'identities',
  path: 'identities',
  writableKeys: [
    'first_name',
    'last_name',
    'phone_number',
    'id_number',
    'birth_date',
    'company_name',
    'company_reg_number',
    'vat_id',
    'description',
    'personal_tax_id',
    'identity_type',
    'external_reference_id',
    'contact_email',
    'country',
  ],
};
