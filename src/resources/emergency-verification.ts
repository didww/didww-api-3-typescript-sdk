import { defineResource, type ResourceRef } from './base.js';
import type { Address } from './address.js';
import type { Did } from './did.js';

export interface EmergencyVerification {
  id: string;
  type: 'emergency_verifications';
  reference: string;
  status: string;
  rejectReasons: string[] | null;
  rejectComment: string | null;
  callbackUrl: string | null;
  callbackMethod: string | null;
  externalReferenceId: string | null;
  createdAt: string;
  address?: Address | ResourceRef;
  emergencyCallingService?: { id: string; type: string } | ResourceRef;
  dids?: (Did | ResourceRef)[];
}

export interface EmergencyVerificationWrite {
  callbackUrl?: string | null;
  callbackMethod?: string | null;
  externalReferenceId?: string | null;
  address?: ResourceRef;
  emergencyCallingService?: ResourceRef;
  dids?: ResourceRef[];
}

export const EMERGENCY_VERIFICATION_RESOURCE = defineResource<EmergencyVerification, EmergencyVerificationWrite>()({
  type: 'emergency_verifications',
  path: 'emergency_verifications',
  writableKeys: ['callbackUrl', 'callbackMethod', 'externalReferenceId', 'address', 'emergencyCallingService', 'dids'],
  relationshipKeys: ['address', 'emergencyCallingService', 'dids'],
  operations: ['list', 'find', 'create', 'update'],
});
