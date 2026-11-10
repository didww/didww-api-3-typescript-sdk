import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { NumberType } from '../enums.js';

export interface EmergencyRequirement {
  id: string;
  type: 'emergency_requirements';
  identityType: string;
  addressAreaLevel: string;
  /** Null when the country does not accept a personal identity for emergency calling. */
  personalAreaLevel: string | null;
  /** Null when the country does not accept a business identity for emergency calling. */
  businessAreaLevel: string | null;
  /** The address fields that must be filled in (`area`); empty when none are. */
  addressMandatoryFields: string[];
  /**
   * The fields that must be filled in for a personal identity, as the API spells
   * them, among `birth_date`, `country`, `id_number`, `personal_tax_id` and
   * `contact_email`; empty when none are.
   */
  personalMandatoryFields: string[];
  /**
   * The fields that must be filled in for a business identity, as the API spells
   * them, among `id_number`, `tax_id` (`Identity.vatId`), `country`,
   * `company_reg_number`, `personal_tax_id`, `contact_email` and `birth_date`;
   * empty when none are.
   */
  businessMandatoryFields: string[];
  estimateSetupTime: string;
  requirementRestrictionMessage: string | null;
  numberType: NumberType | (string & {});
  country?: Country | ResourceRef;
  /**
   * Resource-level meta returned by the server.
   * Contains pricing information: `setupPrice` and `monthlyPrice` (`setup_price` and
   * `monthly_price` on the wire), both decimal strings — e.g.
   * `{ "setupPrice": "0.0", "monthlyPrice": "1.5" }`. Both are null when the account
   * has no emergency plan rate for the country and number type.
   */
  meta?: Record<string, string | null>;
}

export const EMERGENCY_REQUIREMENT_RESOURCE = createReadOnlyResource<EmergencyRequirement>('emergency_requirements');
