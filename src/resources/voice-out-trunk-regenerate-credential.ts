import { defineResource, type ResourceRef } from './base.js';
import type { VoiceOutTrunk } from './voice-out-trunk.js';

export interface VoiceOutTrunkRegenerateCredential {
  id: string;
  type: 'voice_out_trunk_regenerate_credentials';
  voiceOutTrunk?: VoiceOutTrunk | ResourceRef;
}

export interface VoiceOutTrunkRegenerateCredentialWrite {
  voiceOutTrunk?: ResourceRef;
}

export const VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE = defineResource<
  VoiceOutTrunkRegenerateCredential,
  VoiceOutTrunkRegenerateCredentialWrite
>()({
  type: 'voice_out_trunk_regenerate_credentials',
  path: 'voice_out_trunk_regenerate_credentials',
  writableKeys: ['voiceOutTrunk'],
  relationshipKeys: ['voiceOutTrunk'],
  operations: ['list', 'find', 'create', 'remove'],
});
