import type { ResourceConfig, ResourceRef } from './base.js';
import type { AddressVerificationStatus, CallbackMethod } from '../enums.js';
import type { Address } from './address.js';
import type { Did } from './did.js';

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
  address?: Address | ResourceRef;
  dids?: (Did | ResourceRef)[];
}

export interface AddressVerificationWrite {
  serviceDescription?: string;
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
  address?: ResourceRef;
  dids?: ResourceRef[];
}

export const ADDRESS_VERIFICATION_RESOURCE: ResourceConfig<AddressVerification, AddressVerificationWrite> = {
  type: 'address_verifications',
  path: 'address_verifications',
  writableKeys: ['serviceDescription', 'callbackUrl', 'callbackMethod', 'address', 'dids'],
};
