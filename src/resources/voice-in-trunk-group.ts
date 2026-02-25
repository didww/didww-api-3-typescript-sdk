import type { ResourceMeta, ResourceRef } from './base.js';

export interface VoiceInTrunkGroup {
  id: string;
  type: 'voice_in_trunk_groups';
  name: string;
  capacityLimit: string;
  createdAt: string;
  voiceInTrunks?: ResourceRef[];
}

export interface VoiceInTrunkGroupWrite {
  name?: string;
  capacityLimit?: string;
  voiceInTrunks?: ResourceRef[];
}

export const VOICE_IN_TRUNK_GROUP_META: ResourceMeta<VoiceInTrunkGroup, VoiceInTrunkGroupWrite> = {
  type: 'voice_in_trunk_groups',
  path: 'voice_in_trunk_groups',
  writableKeys: ['name', 'capacityLimit', 'voiceInTrunks'],
};
