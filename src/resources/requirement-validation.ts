import type { ResourceConfig, ResourceRef } from './base.js';
import type { Requirement } from './requirement.js';
import type { Identity } from './identity.js';
import type { Address } from './address.js';

export interface RequirementValidation {
  id: string;
  type: 'requirement_validations';
  requirement?: Requirement | ResourceRef;
  identity?: Identity | ResourceRef;
  address?: Address | ResourceRef;
}

export interface RequirementValidationWrite {
  requirement?: ResourceRef;
  identity?: ResourceRef;
  address?: ResourceRef;
}

export const REQUIREMENT_VALIDATION_RESOURCE = {
  type: 'requirement_validations',
  path: 'requirement_validations',
  writableKeys: ['requirement', 'identity', 'address'],
  relationshipKeys: ['requirement', 'identity', 'address'],
  operations: ['list', 'find', 'create', 'remove'],
} as const satisfies ResourceConfig<RequirementValidation, RequirementValidationWrite>;
