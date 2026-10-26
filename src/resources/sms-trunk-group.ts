import { defineResource, type ResourceRef } from './base.js';
import { filterWritableKeys } from '../filter-writable-keys.js';
import type { Did } from './did.js';
import type { SmsTrunk } from './sms-trunk.js';

/**
 * SMS trunk group. Deleting a group also deletes its trunks.
 *
 * Includes: `sms_trunks`, `incoming_dids`.
 */
export interface SmsTrunkGroup {
  id: string;
  type: 'sms_trunk_groups';
  name: string;
  externalReferenceId: string | null;
  createdAt: string;
  updatedAt: string;
  smsTrunks?: (SmsTrunk | ResourceRef)[];
  incomingDids?: (Did | ResourceRef)[];
  /** Resource-level meta: the number of trunks in the group. */
  meta?: { smsTrunksCount?: number };
}

export interface SmsTrunkGroupWrite {
  name?: string;
  externalReferenceId?: string | null;
  /** Replaces the whole membership; `[]` (or `null`) empties the group. `http_out` trunks cannot join. */
  smsTrunks?: ResourceRef[] | null;
}

const WRITABLE_KEYS = [
  'name',
  'externalReferenceId',
  'smsTrunks',
] as const satisfies readonly (keyof SmsTrunkGroupWrite)[];

export const SMS_TRUNK_GROUP_RESOURCE = defineResource<SmsTrunkGroup, SmsTrunkGroupWrite>()({
  type: 'sms_trunk_groups',
  path: 'sms_trunk_groups',
  writableKeys: WRITABLE_KEYS,
  relationshipKeys: ['smsTrunks'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
  serializeCustom(data) {
    const result = filterWritableKeys(data, WRITABLE_KEYS);
    // A to-many relationship is cleared with an empty list, never null.
    if (result.smsTrunks === null) result.smsTrunks = [];
    return result;
  },
});
