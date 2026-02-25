import type { ResourceMeta, ResourceRef } from './base.js';

export interface Did {
  id: string;
  type: 'dids';
  number: string;
  blocked: boolean;
  awaiting_registration: boolean;
  terminated: boolean;
  description: string;
  capacity_limit: string;
  channels_included_count: number;
  dedicated_channels_count: number;
  billing_cycles_count: number;
  created_at: string;
  expires_at: string | null;
  order?: ResourceRef;
  did_group?: ResourceRef;
  voice_in_trunk?: ResourceRef | null;
  voice_in_trunk_group?: ResourceRef | null;
  capacity_pool?: ResourceRef;
  shared_capacity_group?: ResourceRef | null;
  address_verification?: ResourceRef;
}

export interface DidWrite {
  billing_cycles_count?: number;
  capacity_limit?: string;
  description?: string;
  terminated?: boolean;
  dedicated_channels_count?: number;
  voice_in_trunk?: ResourceRef | null;
  voice_in_trunk_group?: ResourceRef | null;
  capacity_pool?: ResourceRef | null;
  shared_capacity_group?: ResourceRef | null;
}

export const DID_META: ResourceMeta<Did, DidWrite> = {
  type: 'dids',
  path: 'dids',
  writableKeys: [
    'billing_cycles_count',
    'capacity_limit',
    'description',
    'terminated',
    'dedicated_channels_count',
    'voice_in_trunk',
    'voice_in_trunk_group',
    'capacity_pool',
    'shared_capacity_group',
  ],
  serializeCustom(data, _method) {
    const result: Record<string, unknown> = {};
    const RELATIONSHIP_KEYS = ['voice_in_trunk', 'voice_in_trunk_group', 'capacity_pool', 'shared_capacity_group'];
    for (const key of DID_META.writableKeys) {
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
    // Exclusive relationships: setting voice_in_trunk nullifies voice_in_trunk_group and vice versa
    if ('voice_in_trunk' in (data as Record<string, unknown>) && (data as Record<string, unknown>).voice_in_trunk !== undefined) {
      if ((data as Record<string, unknown>).voice_in_trunk !== null) {
        result.voice_in_trunk_group = { data: null };
      }
    }
    if ('voice_in_trunk_group' in (data as Record<string, unknown>) && (data as Record<string, unknown>).voice_in_trunk_group !== undefined) {
      if ((data as Record<string, unknown>).voice_in_trunk_group !== null) {
        result.voice_in_trunk = { data: null };
      }
    }
    return result;
  },
};

