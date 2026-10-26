import { defineResource, type ResourceRef } from './base.js';
import { filterWritableKeys } from '../filter-writable-keys.js';
import { DidwwClientError } from '../errors.js';
import type { Order } from './order.js';
import type { DidGroup } from './did-group.js';
import type { VoiceInTrunk } from './voice-in-trunk.js';
import type { VoiceInTrunkGroup } from './voice-in-trunk-group.js';
import type { CapacityPool } from './capacity-pool.js';
import type { SharedCapacityGroup } from './shared-capacity-group.js';
import type { AddressVerification } from './address-verification.js';
import type { EmergencyCallingService } from './emergency-calling-service.js';
import type { EmergencyVerification } from './emergency-verification.js';
import type { Identity } from './identity.js';
import type { SmsTrunk } from './sms-trunk.js';
import type { SmsTrunkGroup } from './sms-trunk-group.js';

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
  emergencyEnabled: boolean;
  order?: Order | ResourceRef;
  didGroup?: DidGroup | ResourceRef;
  voiceInTrunk?: VoiceInTrunk | ResourceRef | null;
  voiceInTrunkGroup?: VoiceInTrunkGroup | ResourceRef | null;
  smsTrunk?: SmsTrunk | ResourceRef | null;
  smsTrunkGroup?: SmsTrunkGroup | ResourceRef | null;
  capacityPool?: CapacityPool | ResourceRef;
  sharedCapacityGroup?: SharedCapacityGroup | ResourceRef | null;
  addressVerification?: AddressVerification | ResourceRef;
  emergencyCallingService?: EmergencyCallingService | ResourceRef | null;
  emergencyVerification?: EmergencyVerification | ResourceRef | null;
  identity?: Identity | ResourceRef | null;
}

export interface DidWrite {
  billingCyclesCount?: number;
  capacityLimit?: number | null;
  description?: string | null;
  terminated?: boolean;
  dedicatedChannelsCount?: number;
  voiceInTrunk?: ResourceRef | null;
  voiceInTrunkGroup?: ResourceRef | null;
  /**
   * Assigning an SMS trunk clears `smsTrunkGroup` and vice versa; setting both
   * throws. `null` clears only itself.
   */
  smsTrunk?: ResourceRef | null;
  smsTrunkGroup?: ResourceRef | null;
  capacityPool?: ResourceRef | null;
  sharedCapacityGroup?: ResourceRef | null;
  emergencyCallingService?: ResourceRef | null;
}

const WRITABLE_KEYS = [
  'billingCyclesCount',
  'capacityLimit',
  'description',
  'terminated',
  'dedicatedChannelsCount',
  'voiceInTrunk',
  'voiceInTrunkGroup',
  'smsTrunk',
  'smsTrunkGroup',
  'capacityPool',
  'sharedCapacityGroup',
  'emergencyCallingService',
] as const satisfies readonly (keyof DidWrite)[];

export const DID_RESOURCE = defineResource<Did, DidWrite>()({
  type: 'dids',
  path: 'dids',
  writableKeys: WRITABLE_KEYS,
  relationshipKeys: [
    'voiceInTrunk',
    'voiceInTrunkGroup',
    'smsTrunk',
    'smsTrunkGroup',
    'capacityPool',
    'sharedCapacityGroup',
    'emergencyCallingService',
  ],
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
    const d = data as Record<string, unknown>;
    const setSmsTrunk = d.smsTrunk !== undefined && d.smsTrunk !== null;
    const setSmsTrunkGroup = d.smsTrunkGroup !== undefined && d.smsTrunkGroup !== null;
    if (setSmsTrunk && setSmsTrunkGroup) {
      throw new DidwwClientError(
        'smsTrunk and smsTrunkGroup are mutually exclusive: assign one of them, and set the other to null to clear it',
      );
    }
    if (setSmsTrunk) result.smsTrunkGroup = null;
    if (setSmsTrunkGroup) result.smsTrunk = null;
    return result;
  },
});
