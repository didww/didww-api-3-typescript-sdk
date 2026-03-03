import type { ResourceConfig, ResourceRef } from './base.js';
import type { VoiceInTrunk } from './voice-in-trunk.js';

export interface VoiceInTrunkGroup {
  id: string;
  type: 'voice_in_trunk_groups';
  name: string;
  capacityLimit: number | null;
  createdAt: string;
  voiceInTrunks?: (VoiceInTrunk | ResourceRef)[];
}

export interface VoiceInTrunkGroupWrite {
  name?: string;
  capacityLimit?: number | null;
  voiceInTrunks?: ResourceRef[];
}

export const VOICE_IN_TRUNK_GROUP_RESOURCE: ResourceConfig<VoiceInTrunkGroup, VoiceInTrunkGroupWrite> = {
  type: 'voice_in_trunk_groups',
  path: 'voice_in_trunk_groups',
  writableKeys: ['name', 'capacityLimit', 'voiceInTrunks'],
};
