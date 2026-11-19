import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { IdentityType, AreaLevel, NumberType } from '../enums.js';
import type { Country } from './country.js';
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
  /**
   * The fields that must be filled in for a personal identity, as the API spells
   * them, among `birth_date`, `country`, `birth_country`, `id_number`,
   * `personal_tax_id` and `contact_email`; empty when none are.
   */
  personalMandatoryFields: string[];
  /**
   * The fields that must be filled in for a business identity, as the API spells
   * them, among `id_number`, `tax_id` (`Identity.vatId`), `country`,
   * `company_reg_number`, `personal_tax_id` and `contact_email`; empty when none are.
   */
  businessMandatoryFields: string[];
  serviceDescriptionRequired: boolean;
  restrictionMessage: string | null;
  numberType: NumberType | (string & {});
  country?: Country | ResourceRef;
  personalPermanentDocument?: SupportingDocumentTemplate | ResourceRef;
  businessPermanentDocument?: SupportingDocumentTemplate | ResourceRef;
  personalOnetimeDocument?: SupportingDocumentTemplate | ResourceRef;
  businessOnetimeDocument?: SupportingDocumentTemplate | ResourceRef;
  personalProofTypes?: (ProofType | ResourceRef)[];
  businessProofTypes?: (ProofType | ResourceRef)[];
  addressProofTypes?: (ProofType | ResourceRef)[];
}

export const ADDRESS_REQUIREMENT_RESOURCE = createReadOnlyResource<AddressRequirement>('address_requirements');
