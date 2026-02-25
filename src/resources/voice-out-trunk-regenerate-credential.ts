import type { ResourceMeta, ResourceRef } from './base.js';

export interface VoiceOutTrunkRegenerateCredential {
  id: string;
  type: 'voice_out_trunk_regenerate_credentials';
  voiceOutTrunk?: ResourceRef;
}

export interface VoiceOutTrunkRegenerateCredentialWrite {
  voiceOutTrunk?: ResourceRef;
}

export const VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_META: ResourceMeta<
  VoiceOutTrunkRegenerateCredential,
  VoiceOutTrunkRegenerateCredentialWrite
> = {
  type: 'voice_out_trunk_regenerate_credentials',
  path: 'voice_out_trunk_regenerate_credentials',
  writableKeys: ['voiceOutTrunk'],
};
