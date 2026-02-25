import type { ResourceMeta, ResourceRef } from './base.js';
import type { IdentityType, AreaLevel } from '../enums.js';

export interface Requirement {
  id: string;
  type: 'requirements';
  identityType: IdentityType;
  personalAreaLevel: AreaLevel;
  businessAreaLevel: AreaLevel;
  addressAreaLevel: AreaLevel;
  personalProofQty: number;
  businessProofQty: number;
  addressProofQty: number;
  personalMandatoryFields: string[];
  businessMandatoryFields: string[];
  serviceDescriptionRequired: boolean;
  restrictionMessage: string | null;
  country?: ResourceRef;
  didGroupType?: ResourceRef;
  personalPermanentDocument?: ResourceRef;
  businessPermanentDocument?: ResourceRef;
  personalOnetimeDocument?: ResourceRef;
  businessOnetimeDocument?: ResourceRef;
  personalProofTypes?: ResourceRef[];
  businessProofTypes?: ResourceRef[];
  addressProofTypes?: ResourceRef[];
}

export const REQUIREMENT_META: ResourceMeta<Requirement> = {
  type: 'requirements',
  path: 'requirements',
  writableKeys: [],
};
