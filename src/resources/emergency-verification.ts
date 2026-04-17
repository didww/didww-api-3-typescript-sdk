import { defineResource, type ResourceRef } from './base.js';
import type { CallbackMethod, EmergencyVerificationStatus } from '../enums.js';
import type { Address } from './address.js';
import type { Did } from './did.js';

export interface EmergencyVerification {
  id: string;
  type: 'emergency_verifications';
  /** DIDWW-assigned human-readable reference (e.g. "EVR-123456"). */
  reference: string;
  /** Current verification status. */
  status: EmergencyVerificationStatus;
  /** Array of rejection reason strings; null when not rejected. */
  rejectReasons: string[] | null;
  /** Free-form comment accompanying a rejection; null when not rejected. */
  rejectComment: string | null;
  /** URL to receive status-change webhooks (POST or GET). */
  callbackUrl: string | null;
  /** HTTP method for the callback: "POST" or "GET". */
  callbackMethod: CallbackMethod | null;
  /** Customer-supplied reference tag (max 100 chars). */
  externalReferenceId: string | null;
  createdAt: string;
  address?: Address | ResourceRef;
  emergencyCallingService?: { id: string; type: string } | ResourceRef;
  dids?: (Did | ResourceRef)[];
}

export interface EmergencyVerificationWrite {
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
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
