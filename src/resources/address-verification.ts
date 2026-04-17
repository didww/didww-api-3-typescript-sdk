import { defineResource, type ResourceRef } from './base.js';
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
  rejectReasons: string[] | null;
  rejectComment: string | null;
  reference: string;
  createdAt: string;
  externalReferenceId: string | null;
  address?: Address | ResourceRef;
  dids?: (Did | ResourceRef)[];
}

export interface AddressVerificationWrite {
  serviceDescription?: string;
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
  externalReferenceId?: string | null;
  address?: ResourceRef;
  dids?: ResourceRef[];
}

export const ADDRESS_VERIFICATION_RESOURCE = defineResource<AddressVerification, AddressVerificationWrite>()({
  type: 'address_verifications',
  path: 'address_verifications',
  writableKeys: ['serviceDescription', 'callbackUrl', 'callbackMethod', 'externalReferenceId', 'address', 'dids'],
  relationshipKeys: ['address', 'dids'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
