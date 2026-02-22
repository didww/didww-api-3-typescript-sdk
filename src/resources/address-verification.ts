import type { ResourceMeta, ResourceRef } from './base.js';

export interface AddressVerification {
  id: string;
  type: 'address_verifications';
  service_description: string;
  callback_url: string | null;
  callback_method: string | null;
  status: string;
  reject_reasons: string[];
  reference: string;
  created_at: string;
  address?: ResourceRef;
  dids?: ResourceRef[];
}

export interface AddressVerificationWrite {
  service_description?: string;
  callback_url?: string | null;
  callback_method?: string | null;
  address?: ResourceRef;
  dids?: ResourceRef[];
}

export const ADDRESS_VERIFICATION_META: ResourceMeta<AddressVerification, AddressVerificationWrite> = {
  type: 'address_verifications',
  path: 'address_verifications',
  writableKeys: ['service_description', 'callback_url', 'callback_method', 'address', 'dids'],
};
