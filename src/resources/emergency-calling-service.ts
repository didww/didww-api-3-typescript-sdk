import { defineResource, type ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { DidGroupType } from './did-group-type.js';
import type { Order } from './order.js';
import type { Address } from './address.js';
import type { EmergencyRequirement } from './emergency-requirement.js';
import type { EmergencyVerification } from './emergency-verification.js';
import type { Did } from './did.js';

export interface EmergencyCallingService {
  id: string;
  type: 'emergency_calling_services';
  name: string;
  reference: string;
  status: string;
  activatedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  renewDate: string | null;
  country?: Country | ResourceRef;
  didGroupType?: DidGroupType | ResourceRef;
  order?: Order | ResourceRef;
  address?: Address | ResourceRef;
  emergencyRequirement?: EmergencyRequirement | ResourceRef;
  emergencyVerification?: EmergencyVerification | ResourceRef;
  dids?: (Did | ResourceRef)[];
}

export const EMERGENCY_CALLING_SERVICE_RESOURCE = defineResource<EmergencyCallingService>()({
  type: 'emergency_calling_services',
  path: 'emergency_calling_services',
  writableKeys: [],
  operations: ['list', 'find', 'remove'],
});
