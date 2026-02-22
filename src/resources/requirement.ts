import type { ResourceMeta, ResourceRef } from './base.js';
import type { IdentityType, AreaLevel } from '../enums.js';

export interface Requirement {
  id: string;
  type: 'requirements';
  identity_type: IdentityType;
  personal_area_level: AreaLevel;
  business_area_level: AreaLevel;
  address_area_level: AreaLevel;
  personal_proof_qty: number;
  business_proof_qty: number;
  address_proof_qty: number;
  personal_mandatory_fields: string[];
  business_mandatory_fields: string[];
  service_description_required: boolean;
  restriction_message: string | null;
  country?: ResourceRef;
  did_group_type?: ResourceRef;
  personal_permanent_document?: ResourceRef;
  business_permanent_document?: ResourceRef;
  personal_onetime_document?: ResourceRef;
  business_onetime_document?: ResourceRef;
  personal_proof_types?: ResourceRef[];
  business_proof_types?: ResourceRef[];
  address_proof_types?: ResourceRef[];
}

export const REQUIREMENT_META: ResourceMeta<Requirement> = {
  type: 'requirements',
  path: 'requirements',
  writableKeys: [],
};
