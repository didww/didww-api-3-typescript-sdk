import type { ResourceMeta, ResourceRef } from './base.js';

export interface VoiceInTrunkGroup {
  id: string;
  type: 'voice_in_trunk_groups';
  name: string;
  capacity_limit: string;
  created_at: string;
  voice_in_trunks?: ResourceRef[];
}

export interface VoiceInTrunkGroupWrite {
  name?: string;
  capacity_limit?: string;
  voice_in_trunks?: ResourceRef[];
}

export const VOICE_IN_TRUNK_GROUP_META: ResourceMeta<VoiceInTrunkGroup, VoiceInTrunkGroupWrite> = {
  type: 'voice_in_trunk_groups',
  path: 'voice_in_trunk_groups',
  writableKeys: ['name', 'capacity_limit', 'voice_in_trunks'],
};
