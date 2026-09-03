import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { DidGroupType } from './did-group-type.js';

export interface EmergencyRequirement {
  id: string;
  type: 'emergency_requirements';
  identityType: string;
  addressAreaLevel: string;
  /** Null when the country does not accept a personal identity for emergency calling. */
  personalAreaLevel: string | null;
  /** Null when the country does not accept a business identity for emergency calling. */
  businessAreaLevel: string | null;
  addressMandatoryFields: string[];
  personalMandatoryFields: string[];
  businessMandatoryFields: string[];
  estimateSetupTime: string;
  requirementRestrictionMessage: string | null;
  country?: Country | ResourceRef;
  didGroupType?: DidGroupType | ResourceRef;
  /**
   * Resource-level meta returned by the server.
   * Contains pricing information: `setupPrice` and `monthlyPrice` (`setup_price` and
   * `monthly_price` on the wire), both decimal strings — e.g.
   * `{ "setupPrice": "0.0", "monthlyPrice": "1.5" }`. Both are null when the account
   * has no emergency plan rate for the country and DID group type.
   */
  meta?: Record<string, string | null>;
}

export const EMERGENCY_REQUIREMENT_RESOURCE = createReadOnlyResource<EmergencyRequirement>('emergency_requirements');
