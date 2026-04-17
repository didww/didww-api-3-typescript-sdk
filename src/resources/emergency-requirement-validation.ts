import { defineResource, type ResourceRef } from './base.js';
import type { EmergencyRequirement } from './emergency-requirement.js';
import type { Address } from './address.js';
import type { Identity } from './identity.js';

export interface EmergencyRequirementValidation {
  id: string;
  type: 'emergency_requirement_validations';
  emergencyRequirement?: EmergencyRequirement | ResourceRef;
  address?: Address | ResourceRef;
  identity?: Identity | ResourceRef;
}

export interface EmergencyRequirementValidationWrite {
  emergencyRequirement?: ResourceRef;
  address?: ResourceRef;
  identity?: ResourceRef;
}

export const EMERGENCY_REQUIREMENT_VALIDATION_RESOURCE = defineResource<
  EmergencyRequirementValidation,
  EmergencyRequirementValidationWrite
>()({
  type: 'emergency_requirement_validations',
  path: 'emergency_requirement_validations',
  writableKeys: ['emergencyRequirement', 'address', 'identity'],
  relationshipKeys: ['emergencyRequirement', 'address', 'identity'],
  operations: ['create'],
});
