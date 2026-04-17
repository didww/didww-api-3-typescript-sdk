import { defineResource, type ResourceRef } from './base.js';
import type { AddressRequirement } from './address-requirement.js';
import type { Identity } from './identity.js';
import type { Address } from './address.js';

export interface AddressRequirementValidation {
  id: string;
  type: 'address_requirement_validations';
  requirement?: AddressRequirement | ResourceRef;
  identity?: Identity | ResourceRef;
  address?: Address | ResourceRef;
}

export interface AddressRequirementValidationWrite {
  requirement?: ResourceRef;
  identity?: ResourceRef;
  address?: ResourceRef;
}

export const ADDRESS_REQUIREMENT_VALIDATION_RESOURCE = defineResource<
  AddressRequirementValidation,
  AddressRequirementValidationWrite
>()({
  type: 'address_requirement_validations',
  path: 'address_requirement_validations',
  writableKeys: ['requirement', 'identity', 'address'],
  relationshipKeys: ['requirement', 'identity', 'address'],
  operations: ['list', 'find', 'create', 'remove'],
});
