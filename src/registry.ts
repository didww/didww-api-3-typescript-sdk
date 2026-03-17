import type { ResourceConfig } from './resources/base.js';

import { COUNTRY_RESOURCE } from './resources/country.js';
import { REGION_RESOURCE } from './resources/region.js';
import { CITY_RESOURCE } from './resources/city.js';
import { AREA_RESOURCE } from './resources/area.js';
import { POP_RESOURCE } from './resources/pop.js';
import { BALANCE_RESOURCE } from './resources/balance.js';
import { DID_GROUP_TYPE_RESOURCE } from './resources/did-group-type.js';
import { DID_GROUP_RESOURCE } from './resources/did-group.js';
import { AVAILABLE_DID_RESOURCE } from './resources/available-did.js';
import { NANPA_PREFIX_RESOURCE } from './resources/nanpa-prefix.js';
import { PROOF_TYPE_RESOURCE } from './resources/proof-type.js';
import { PUBLIC_KEY_RESOURCE } from './resources/public-key.js';
import { REQUIREMENT_RESOURCE } from './resources/requirement.js';
import { SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE } from './resources/supporting-document-template.js';
import { STOCK_KEEPING_UNIT_RESOURCE } from './resources/stock-keeping-unit.js';
import { QTY_BASED_PRICING_RESOURCE } from './resources/qty-based-pricing.js';
import { CAPACITY_POOL_RESOURCE } from './resources/capacity-pool.js';
import { VOICE_IN_TRUNK_RESOURCE } from './resources/voice-in-trunk.js';
import { VOICE_IN_TRUNK_GROUP_RESOURCE } from './resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_RESOURCE } from './resources/voice-out-trunk.js';
import { SHARED_CAPACITY_GROUP_RESOURCE } from './resources/shared-capacity-group.js';
import { DID_RESOURCE } from './resources/did.js';
import { ORDER_RESOURCE } from './resources/order.js';
import { EXPORT_RESOURCE } from './resources/export.js';
import { DID_RESERVATION_RESOURCE } from './resources/did-reservation.js';
import { ADDRESS_RESOURCE } from './resources/address.js';
import { IDENTITY_RESOURCE } from './resources/identity.js';
import { ENCRYPTED_FILE_RESOURCE } from './resources/encrypted-file.js';
import { ADDRESS_VERIFICATION_RESOURCE } from './resources/address-verification.js';
import { PERMANENT_SUPPORTING_DOCUMENT_RESOURCE } from './resources/permanent-supporting-document.js';
import { PROOF_RESOURCE } from './resources/proof.js';
import { REQUIREMENT_VALIDATION_RESOURCE } from './resources/requirement-validation.js';
import { VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE } from './resources/voice-out-trunk-regenerate-credential.js';

const REGISTRY: ReadonlyMap<string, ResourceConfig> = new Map<string, ResourceConfig>([
  [COUNTRY_RESOURCE.type, COUNTRY_RESOURCE],
  [REGION_RESOURCE.type, REGION_RESOURCE],
  [CITY_RESOURCE.type, CITY_RESOURCE],
  [AREA_RESOURCE.type, AREA_RESOURCE],
  [POP_RESOURCE.type, POP_RESOURCE],
  [BALANCE_RESOURCE.type, BALANCE_RESOURCE],
  [DID_GROUP_TYPE_RESOURCE.type, DID_GROUP_TYPE_RESOURCE],
  [DID_GROUP_RESOURCE.type, DID_GROUP_RESOURCE],
  [AVAILABLE_DID_RESOURCE.type, AVAILABLE_DID_RESOURCE],
  [NANPA_PREFIX_RESOURCE.type, NANPA_PREFIX_RESOURCE],
  [PROOF_TYPE_RESOURCE.type, PROOF_TYPE_RESOURCE],
  [PUBLIC_KEY_RESOURCE.type, PUBLIC_KEY_RESOURCE],
  [REQUIREMENT_RESOURCE.type, REQUIREMENT_RESOURCE],
  [SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE.type, SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE],
  [STOCK_KEEPING_UNIT_RESOURCE.type, STOCK_KEEPING_UNIT_RESOURCE],
  [QTY_BASED_PRICING_RESOURCE.type, QTY_BASED_PRICING_RESOURCE],
  [CAPACITY_POOL_RESOURCE.type, CAPACITY_POOL_RESOURCE],
  [VOICE_IN_TRUNK_RESOURCE.type, VOICE_IN_TRUNK_RESOURCE],
  [VOICE_IN_TRUNK_GROUP_RESOURCE.type, VOICE_IN_TRUNK_GROUP_RESOURCE],
  [VOICE_OUT_TRUNK_RESOURCE.type, VOICE_OUT_TRUNK_RESOURCE],
  [SHARED_CAPACITY_GROUP_RESOURCE.type, SHARED_CAPACITY_GROUP_RESOURCE],
  [DID_RESOURCE.type, DID_RESOURCE],
  [ORDER_RESOURCE.type, ORDER_RESOURCE],
  [EXPORT_RESOURCE.type, EXPORT_RESOURCE],
  [DID_RESERVATION_RESOURCE.type, DID_RESERVATION_RESOURCE],
  [ADDRESS_RESOURCE.type, ADDRESS_RESOURCE],
  [IDENTITY_RESOURCE.type, IDENTITY_RESOURCE],
  [ENCRYPTED_FILE_RESOURCE.type, ENCRYPTED_FILE_RESOURCE],
  [ADDRESS_VERIFICATION_RESOURCE.type, ADDRESS_VERIFICATION_RESOURCE],
  [PERMANENT_SUPPORTING_DOCUMENT_RESOURCE.type, PERMANENT_SUPPORTING_DOCUMENT_RESOURCE],
  [PROOF_RESOURCE.type, PROOF_RESOURCE],
  [REQUIREMENT_VALIDATION_RESOURCE.type, REQUIREMENT_VALIDATION_RESOURCE],
  [VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE.type, VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE],
]);

export function getResourceConfig(type: string): ResourceConfig | undefined {
  return REGISTRY.get(type);
}
