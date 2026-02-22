import type { ResourceMeta, ResourceRef } from './base.js';

export interface RequirementValidation {
  id: string;
  type: 'requirement_validations';
  requirement?: ResourceRef;
  identity?: ResourceRef;
  address?: ResourceRef;
}

export interface RequirementValidationWrite {
  requirement?: ResourceRef;
  identity?: ResourceRef;
  address?: ResourceRef;
}

export const REQUIREMENT_VALIDATION_META: ResourceMeta<RequirementValidation, RequirementValidationWrite> = {
  type: 'requirement_validations',
  path: 'requirement_validations',
  writableKeys: ['requirement', 'identity', 'address'],
};
