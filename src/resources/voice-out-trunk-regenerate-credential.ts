import type { ResourceMeta, ResourceRef } from './base.js';

export interface VoiceOutTrunkRegenerateCredential {
  id: string;
  type: 'voice_out_trunk_regenerate_credentials';
  voice_out_trunk?: ResourceRef;
}

export interface VoiceOutTrunkRegenerateCredentialWrite {
  voice_out_trunk?: ResourceRef;
}

export const VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_META: ResourceMeta<
  VoiceOutTrunkRegenerateCredential,
  VoiceOutTrunkRegenerateCredentialWrite
> = {
  type: 'voice_out_trunk_regenerate_credentials',
  path: 'voice_out_trunk_regenerate_credentials',
  writableKeys: ['voice_out_trunk'],
};
