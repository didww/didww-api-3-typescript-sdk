import { defineResource, type ResourceRef } from './base.js';
import type { SenderIdVerificationStatus, SenderType } from '../enums.js';
import type { SmsTrunk } from './sms-trunk.js';
import type { Country } from './country.js';
import type { Did } from './did.js';
import type { Order } from './order.js';
import type { Identity } from './identity.js';
import type { Address } from './address.js';

/**
 * Sender ID verification. Only `name` and `smsTrunk` can be changed; a
 * `closed` verification refuses updates.
 *
 * Includes: `sms_trunk`, `countries`, `dids`, `order`, `identity`, `address`.
 */
export interface SenderIdVerification {
  id: string;
  type: 'sender_id_verifications';
  name: string;
  status: SenderIdVerificationStatus | (string & {});
  senderType: SenderType | (string & {});
  senderIds: string[];
  reference: string;
  rejectReasons: string[] | null;
  rejectComment: string | null;
  /** Next renewal date, `YYYY-MM-DD`; null once closed. */
  renewDate: string | null;
  createdAt: string;
  activatedAt: string | null;
  closedAt: string | null;
  smsTrunk?: SmsTrunk | ResourceRef | null;
  countries?: (Country | ResourceRef)[];
  dids?: (Did | ResourceRef)[];
  order?: Order | ResourceRef;
  identity?: Identity | ResourceRef | null;
  address?: Address | ResourceRef | null;
  /** Resource-level meta: `setupPrice` and `monthlyPrice`, decimal strings. */
  meta?: { setupPrice?: string; monthlyPrice?: string };
}

export interface SenderIdVerificationWrite {
  name?: string;
  /** Only `http_out`, `smpp_smsc` and `smpp_esme` trunks are accepted; `null` unassigns the trunk. */
  smsTrunk?: ResourceRef | null;
}

export const SENDER_ID_VERIFICATION_RESOURCE = defineResource<SenderIdVerification, SenderIdVerificationWrite>()({
  type: 'sender_id_verifications',
  path: 'sender_id_verifications',
  writableKeys: ['name', 'smsTrunk'],
  relationshipKeys: ['smsTrunk'],
  operations: ['list', 'find', 'update'],
});
