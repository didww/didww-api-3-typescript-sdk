import type { ResourceMeta } from './resources/base.js';

import { COUNTRY_META } from './resources/country.js';
import { REGION_META } from './resources/region.js';
import { CITY_META } from './resources/city.js';
import { AREA_META } from './resources/area.js';
import { POP_META } from './resources/pop.js';
import { BALANCE_META } from './resources/balance.js';
import { DID_GROUP_TYPE_META } from './resources/did-group-type.js';
import { DID_GROUP_META } from './resources/did-group.js';
import { AVAILABLE_DID_META } from './resources/available-did.js';
import { NANPA_PREFIX_META } from './resources/nanpa-prefix.js';
import { PROOF_TYPE_META } from './resources/proof-type.js';
import { PUBLIC_KEY_META } from './resources/public-key.js';
import { REQUIREMENT_META } from './resources/requirement.js';
import { SUPPORTING_DOCUMENT_TEMPLATE_META } from './resources/supporting-document-template.js';
import { STOCK_KEEPING_UNIT_META } from './resources/stock-keeping-unit.js';
import { QTY_BASED_PRICING_META } from './resources/qty-based-pricing.js';
import { CAPACITY_POOL_META } from './resources/capacity-pool.js';
import { VOICE_IN_TRUNK_META } from './resources/voice-in-trunk.js';
import { VOICE_IN_TRUNK_GROUP_META } from './resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_META } from './resources/voice-out-trunk.js';
import { SHARED_CAPACITY_GROUP_META } from './resources/shared-capacity-group.js';
import { DID_META } from './resources/did.js';
import { ORDER_META } from './resources/order.js';
import { EXPORT_META } from './resources/export.js';
import { DID_RESERVATION_META } from './resources/did-reservation.js';
import { ADDRESS_META } from './resources/address.js';
import { IDENTITY_META } from './resources/identity.js';
import { ENCRYPTED_FILE_META } from './resources/encrypted-file.js';
import { ADDRESS_VERIFICATION_META } from './resources/address-verification.js';
import { PERMANENT_SUPPORTING_DOCUMENT_META } from './resources/permanent-supporting-document.js';
import { PROOF_META } from './resources/proof.js';
import { REQUIREMENT_VALIDATION_META } from './resources/requirement-validation.js';
import { VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_META } from './resources/voice-out-trunk-regenerate-credential.js';

const REGISTRY: ReadonlyMap<string, ResourceMeta> = new Map<string, ResourceMeta>([
  [COUNTRY_META.type, COUNTRY_META],
  [REGION_META.type, REGION_META],
  [CITY_META.type, CITY_META],
  [AREA_META.type, AREA_META],
  [POP_META.type, POP_META],
  [BALANCE_META.type, BALANCE_META],
  [DID_GROUP_TYPE_META.type, DID_GROUP_TYPE_META],
  [DID_GROUP_META.type, DID_GROUP_META],
  [AVAILABLE_DID_META.type, AVAILABLE_DID_META],
  [NANPA_PREFIX_META.type, NANPA_PREFIX_META],
  [PROOF_TYPE_META.type, PROOF_TYPE_META],
  [PUBLIC_KEY_META.type, PUBLIC_KEY_META],
  [REQUIREMENT_META.type, REQUIREMENT_META],
  [SUPPORTING_DOCUMENT_TEMPLATE_META.type, SUPPORTING_DOCUMENT_TEMPLATE_META],
  [STOCK_KEEPING_UNIT_META.type, STOCK_KEEPING_UNIT_META],
  [QTY_BASED_PRICING_META.type, QTY_BASED_PRICING_META],
  [CAPACITY_POOL_META.type, CAPACITY_POOL_META],
  [VOICE_IN_TRUNK_META.type, VOICE_IN_TRUNK_META],
  [VOICE_IN_TRUNK_GROUP_META.type, VOICE_IN_TRUNK_GROUP_META],
  [VOICE_OUT_TRUNK_META.type, VOICE_OUT_TRUNK_META],
  [SHARED_CAPACITY_GROUP_META.type, SHARED_CAPACITY_GROUP_META],
  [DID_META.type, DID_META],
  [ORDER_META.type, ORDER_META],
  [EXPORT_META.type, EXPORT_META],
  [DID_RESERVATION_META.type, DID_RESERVATION_META],
  [ADDRESS_META.type, ADDRESS_META],
  [IDENTITY_META.type, IDENTITY_META],
  [ENCRYPTED_FILE_META.type, ENCRYPTED_FILE_META],
  [ADDRESS_VERIFICATION_META.type, ADDRESS_VERIFICATION_META],
  [PERMANENT_SUPPORTING_DOCUMENT_META.type, PERMANENT_SUPPORTING_DOCUMENT_META],
  [PROOF_META.type, PROOF_META],
  [REQUIREMENT_VALIDATION_META.type, REQUIREMENT_VALIDATION_META],
  [VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_META.type, VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_META],
]);

export function getResourceMeta(type: string): ResourceMeta | undefined {
  return REGISTRY.get(type);
}
