import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { IdentityType, AreaLevel } from '../enums.js';
import type { Country } from './country.js';
import type { DidGroupType } from './did-group-type.js';
import type { SupportingDocumentTemplate } from './supporting-document-template.js';
import type { ProofType } from './proof-type.js';

export interface AddressRequirement {
  id: string;
  type: 'address_requirements';
  identityType: IdentityType;
  /** Null when the country does not accept a personal identity. */
  personalAreaLevel: AreaLevel | null;
  /** Null when the country does not accept a business identity. */
  businessAreaLevel: AreaLevel | null;
  addressAreaLevel: AreaLevel;
  personalProofQty: number;
  businessProofQty: number;
  addressProofQty: number;
  /** Null when no field is mandatory for a personal identity. */
  personalMandatoryFields: string[] | null;
  /** Null when no field is mandatory for a business identity. */
  businessMandatoryFields: string[] | null;
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

export const ADDRESS_REQUIREMENT_RESOURCE = createReadOnlyResource<AddressRequirement>('address_requirements');
