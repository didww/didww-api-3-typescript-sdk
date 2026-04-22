import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { DidGroupType } from './did-group-type.js';

export interface EmergencyRequirement {
  id: string;
  type: 'emergency_requirements';
  identityType: string;
  addressAreaLevel: string;
  personalAreaLevel: string;
  businessAreaLevel: string;
  addressMandatoryFields: string[];
  personalMandatoryFields: string[];
  businessMandatoryFields: string[];
  estimateSetupTime: string;
  requirementRestrictionMessage: string | null;
  country?: Country | ResourceRef;
  didGroupType?: DidGroupType | ResourceRef;
}

export const EMERGENCY_REQUIREMENT_RESOURCE = createReadOnlyResource<EmergencyRequirement>('emergency_requirements');
