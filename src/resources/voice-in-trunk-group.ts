import { defineResource, type ResourceRef } from './base.js';
import type { VoiceInTrunk } from './voice-in-trunk.js';

export interface VoiceInTrunkGroup {
  id: string;
  type: 'voice_in_trunk_groups';
  name: string;
  capacityLimit: number | null;
  createdAt: string;
  externalReferenceId: string | null;
  voiceInTrunks?: (VoiceInTrunk | ResourceRef)[];
}

export interface VoiceInTrunkGroupWrite {
  name?: string;
  capacityLimit?: number | null;
  externalReferenceId?: string | null;
  voiceInTrunks?: ResourceRef[];
}

export const VOICE_IN_TRUNK_GROUP_RESOURCE = defineResource<VoiceInTrunkGroup, VoiceInTrunkGroupWrite>()({
  type: 'voice_in_trunk_groups',
  path: 'voice_in_trunk_groups',
  writableKeys: ['name', 'capacityLimit', 'externalReferenceId', 'voiceInTrunks'],
  relationshipKeys: ['voiceInTrunks'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
