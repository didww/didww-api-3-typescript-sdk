import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { IdentityType, AreaLevel } from '../enums.js';
import type { Country } from './country.js';
import type { DidGroupType } from './did-group-type.js';
import type { SupportingDocumentTemplate } from './supporting-document-template.js';
import type { ProofType } from './proof-type.js';

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
  country?: Country | ResourceRef;
  didGroupType?: DidGroupType | ResourceRef;
  personalPermanentDocument?: SupportingDocumentTemplate | ResourceRef;
  businessPermanentDocument?: SupportingDocumentTemplate | ResourceRef;
  personalOnetimeDocument?: SupportingDocumentTemplate | ResourceRef;
  businessOnetimeDocument?: SupportingDocumentTemplate | ResourceRef;
  personalProofTypes?: (ProofType | ResourceRef)[];
  businessProofTypes?: (ProofType | ResourceRef)[];
  addressProofTypes?: (ProofType | ResourceRef)[];
}

export const REQUIREMENT_RESOURCE = createReadOnlyResource<Requirement>('requirements');
