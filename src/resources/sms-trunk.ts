import { defineResource, type ResourceRef } from './base.js';
import { filterWritableKeys } from '../filter-writable-keys.js';
import { isPlainObject } from '../json.js';
import {
  deserializeSmsTrunkConfiguration,
  serializeSmsTrunkConfiguration,
  type SmsTrunkConfiguration,
} from '../nested/sms-trunk-configuration.js';
import type { Did } from './did.js';
import type { SmsTrunkGroup } from './sms-trunk-group.js';
import type { SenderIdVerification } from './sender-id-verification.js';

/**
 * SMS trunk.
 *
 * Filters: `id`, `name`, `external_reference_id`, `configuration.type`.
 * Includes: `outgoing_dids`, `incoming_dids`, `sms_trunk_group`, `sender_id_verifications`.
 */
export interface SmsTrunk {
  id: string;
  type: 'sms_trunks';
  name: string;
  externalReferenceId: string | null;
  blocked: boolean;
  /** 0–32767, 100 by default; null on `http_out` trunks. */
  priority: number | null;
  allowAnyDidAsSource: boolean;
  allowIn: boolean;
  allowOut: boolean;
  createdAt: string;
  updatedAt: string;
  configuration: SmsTrunkConfiguration;
  outgoingDids?: (Did | ResourceRef)[];
  incomingDids?: (Did | ResourceRef)[];
  smsTrunkGroup?: SmsTrunkGroup | ResourceRef | null;
  senderIdVerifications?: (SenderIdVerification | ResourceRef)[];
  /** Resource-level meta: `host` is the endpoint of an `http_out` trunk. */
  meta?: { host?: string };
}

export interface SmsTrunkWrite {
  name?: string;
  externalReferenceId?: string | null;
  blocked?: boolean;
  /** Must stay unset (or null) on `http_out` trunks. */
  priority?: number | null;
  /**
   * When set to true, an `outgoingDids` list loaded with
   * `include: 'outgoing_dids'` and left unchanged is sent empty in the same
   * request, because it must stay empty while the flag is on. A list set in
   * the same update, or on a spread copy, is sent as given.
   */
  allowAnyDidAsSource?: boolean;
  /** On update the type must match the trunk's; attributes left out keep their values. */
  configuration?: SmsTrunkConfiguration;
  /** Replaces the whole list; `[]` (or `null`) clears it. */
  outgoingDids?: ResourceRef[] | null;
  /** `null` takes the trunk out of its group. */
  smsTrunkGroup?: ResourceRef | null;
}

const WRITABLE_KEYS = [
  'name',
  'externalReferenceId',
  'blocked',
  'priority',
  'allowAnyDidAsSource',
  'configuration',
  'outgoingDids',
  'smsTrunkGroup',
] as const satisfies readonly (keyof SmsTrunkWrite)[];

export const SMS_TRUNK_RESOURCE = defineResource<SmsTrunk, SmsTrunkWrite>()({
  type: 'sms_trunks',
  path: 'sms_trunks',
  writableKeys: WRITABLE_KEYS,
  relationshipKeys: ['outgoingDids', 'smsTrunkGroup'],
  wireAttributes: ['configuration'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
  serializeCustom(data, _method, source) {
    const result = filterWritableKeys(data, WRITABLE_KEYS);
    if (result.configuration != null) {
      result.configuration = serializeSmsTrunkConfiguration(result.configuration as SmsTrunkConfiguration);
    }
    // A to-many relationship is cleared with an empty list, never null.
    if (result.outgoingDids === null) result.outgoingDids = [];
    if (
      result.allowAnyDidAsSource === true &&
      !('outgoingDids' in result) &&
      Array.isArray((source as Record<string, unknown> | undefined)?.outgoingDids)
    ) {
      result.outgoingDids = [];
    }
    return result;
  },
  deserializeCustom(data: Record<string, unknown>) {
    const config = data.configuration;
    if (isPlainObject(config) && typeof config.type === 'string') {
      return { configuration: deserializeSmsTrunkConfiguration(config) };
    }
    return {};
  },
});
