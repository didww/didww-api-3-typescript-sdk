import { defineResource, type ResourceRef } from './base.js';
import { filterWritableKeys } from '../filter-writable-keys.js';
import type { Order } from './order.js';
import type { DidGroup } from './did-group.js';
import type { VoiceInTrunk } from './voice-in-trunk.js';
import type { VoiceInTrunkGroup } from './voice-in-trunk-group.js';
import type { CapacityPool } from './capacity-pool.js';
import type { SharedCapacityGroup } from './shared-capacity-group.js';
import type { AddressVerification } from './address-verification.js';

export interface Did {
  id: string;
  type: 'dids';
  number: string;
  blocked: boolean;
  awaitingRegistration: boolean;
  terminated: boolean;
  description: string | null;
  capacityLimit: number | null;
  channelsIncludedCount: number;
  dedicatedChannelsCount: number;
  billingCyclesCount: number;
  createdAt: string;
  expiresAt: string | null;
  order?: Order | ResourceRef;
  didGroup?: DidGroup | ResourceRef;
  voiceInTrunk?: VoiceInTrunk | ResourceRef | null;
  voiceInTrunkGroup?: VoiceInTrunkGroup | ResourceRef | null;
  capacityPool?: CapacityPool | ResourceRef;
  sharedCapacityGroup?: SharedCapacityGroup | ResourceRef | null;
  addressVerification?: AddressVerification | ResourceRef;
}

export interface DidWrite {
  billingCyclesCount?: number;
  capacityLimit?: number | null;
  description?: string | null;
  terminated?: boolean;
  dedicatedChannelsCount?: number;
  voiceInTrunk?: ResourceRef | null;
  voiceInTrunkGroup?: ResourceRef | null;
  capacityPool?: ResourceRef | null;
  sharedCapacityGroup?: ResourceRef | null;
}

const WRITABLE_KEYS = [
  'billingCyclesCount',
  'capacityLimit',
  'description',
  'terminated',
  'dedicatedChannelsCount',
  'voiceInTrunk',
  'voiceInTrunkGroup',
  'capacityPool',
  'sharedCapacityGroup',
] as const satisfies readonly (keyof DidWrite)[];

export const DID_RESOURCE = defineResource<Did, DidWrite>()({
  type: 'dids',
  path: 'dids',
  writableKeys: WRITABLE_KEYS,
  relationshipKeys: ['voiceInTrunk', 'voiceInTrunkGroup', 'capacityPool', 'sharedCapacityGroup'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
  serializeCustom(data: DidWrite, _method: 'POST' | 'PATCH') {
    const result = filterWritableKeys(data, WRITABLE_KEYS);
    // Exclusive relationships: setting voiceInTrunk nullifies voiceInTrunkGroup and vice versa
    if (
      'voiceInTrunk' in (data as Record<string, unknown>) &&
      (data as Record<string, unknown>).voiceInTrunk !== undefined
    ) {
      if ((data as Record<string, unknown>).voiceInTrunk !== null) {
        result.voiceInTrunkGroup = null;
      }
    }
    if (
      'voiceInTrunkGroup' in (data as Record<string, unknown>) &&
      (data as Record<string, unknown>).voiceInTrunkGroup !== undefined
    ) {
      if ((data as Record<string, unknown>).voiceInTrunkGroup !== null) {
        result.voiceInTrunk = null;
      }
    }
    return result;
  },
});
