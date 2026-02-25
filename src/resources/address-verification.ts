import type { ResourceMeta, ResourceRef } from './base.js';
import type { AddressVerificationStatus, CallbackMethod } from '../enums.js';

export interface AddressVerification {
  id: string;
  type: 'address_verifications';
  serviceDescription: string;
  callbackUrl: string | null;
  callbackMethod: CallbackMethod | null;
  status: AddressVerificationStatus;
  rejectReasons: string[];
  reference: string;
  createdAt: string;
  address?: ResourceRef;
  dids?: ResourceRef[];
}

export interface AddressVerificationWrite {
  serviceDescription?: string;
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
  address?: ResourceRef;
  dids?: ResourceRef[];
}

export const ADDRESS_VERIFICATION_META: ResourceMeta<AddressVerification, AddressVerificationWrite> = {
  type: 'address_verifications',
  path: 'address_verifications',
  writableKeys: ['serviceDescription', 'callbackUrl', 'callbackMethod', 'address', 'dids'],
};
