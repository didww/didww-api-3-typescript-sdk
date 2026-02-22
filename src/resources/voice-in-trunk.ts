import type { ResourceMeta, ResourceRef } from './base.js';
import type { TrunkConfiguration } from '../nested/trunk-configuration.js';
import { serializeTrunkConfiguration, deserializeTrunkConfiguration } from '../nested/trunk-configuration.js';

export interface VoiceInTrunk {
  id: string;
  type: 'voice_in_trunks';
  name: string;
  priority: number;
  weight: number;
  cli_format: string;
  cli_prefix: string;
  description: string;
  ringing_timeout: number;
  capacity_limit: string;
  configuration: TrunkConfiguration;
  created_at: string;
  pop?: ResourceRef;
  voice_in_trunk_group?: ResourceRef;
}

export interface VoiceInTrunkWrite {
  name?: string;
  priority?: number;
  weight?: number;
  cli_format?: string;
  cli_prefix?: string;
  description?: string;
  ringing_timeout?: number;
  capacity_limit?: string;
  configuration?: TrunkConfiguration;
  pop?: ResourceRef;
  voice_in_trunk_group?: ResourceRef;
}

export const VOICE_IN_TRUNK_META: ResourceMeta<VoiceInTrunk, VoiceInTrunkWrite> = {
  type: 'voice_in_trunks',
  path: 'voice_in_trunks',
  writableKeys: [
    'name',
    'priority',
    'weight',
    'cli_format',
    'cli_prefix',
    'description',
    'ringing_timeout',
    'capacity_limit',
    'configuration',
    'pop',
    'voice_in_trunk_group',
  ],
  serializeCustom(data, _method) {
    const result: Record<string, unknown> = {};
    for (const key of VOICE_IN_TRUNK_META.writableKeys) {
      if (key in (data as any)) {
        result[key as string] = (data as any)[key];
      }
    }
    if (result.configuration) {
      result.configuration = serializeTrunkConfiguration(result.configuration as TrunkConfiguration);
    }
    return result;
  },
  deserializeCustom(data) {
    const config = (data as any).configuration;
    if (config && typeof config === 'object' && 'type' in config && 'attributes' in config) {
      return { configuration: deserializeTrunkConfiguration(config as Record<string, unknown>) } as any;
    }
    return {};
  },
};
