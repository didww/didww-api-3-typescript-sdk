import type { ResourceConfig, ResourceRef } from './base.js';
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
  description: string;
  capacityLimit: string;
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
  capacityLimit?: string;
  description?: string;
  terminated?: boolean;
  dedicatedChannelsCount?: number;
  voiceInTrunk?: ResourceRef | null;
  voiceInTrunkGroup?: ResourceRef | null;
  capacityPool?: ResourceRef | null;
  sharedCapacityGroup?: ResourceRef | null;
}

export const DID_RESOURCE: ResourceConfig<Did, DidWrite> = {
  type: 'dids',
  path: 'dids',
  writableKeys: [
    'billingCyclesCount',
    'capacityLimit',
    'description',
    'terminated',
    'dedicatedChannelsCount',
    'voiceInTrunk',
    'voiceInTrunkGroup',
    'capacityPool',
    'sharedCapacityGroup',
  ],
  serializeCustom(data, _method) {
    const result: Record<string, unknown> = {};
    const RELATIONSHIP_KEYS = ['voiceInTrunk', 'voiceInTrunkGroup', 'capacityPool', 'sharedCapacityGroup'];
    for (const key of DID_RESOURCE.writableKeys) {
      if (key in (data as Record<string, unknown>)) {
        const value = (data as Record<string, unknown>)[key];
        // Null relationships need { data: null } format for JSON:API
        if (value === null && RELATIONSHIP_KEYS.includes(key as string)) {
          result[key as string] = { data: null };
        } else {
          result[key as string] = value;
        }
      }
    }
    // Exclusive relationships: setting voiceInTrunk nullifies voiceInTrunkGroup and vice versa
    if (
      'voiceInTrunk' in (data as Record<string, unknown>) &&
      (data as Record<string, unknown>).voiceInTrunk !== undefined
    ) {
      if ((data as Record<string, unknown>).voiceInTrunk !== null) {
        result.voiceInTrunkGroup = { data: null };
      }
    }
    if (
      'voiceInTrunkGroup' in (data as Record<string, unknown>) &&
      (data as Record<string, unknown>).voiceInTrunkGroup !== undefined
    ) {
      if ((data as Record<string, unknown>).voiceInTrunkGroup !== null) {
        result.voiceInTrunk = { data: null };
      }
    }
    return result;
  },
};
