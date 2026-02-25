import type { ResourceConfig, ResourceRef } from './base.js';
import type { TrunkConfiguration } from '../nested/trunk-configuration.js';
import type { CliFormat } from '../enums.js';
import type { Pop } from './pop.js';
import type { VoiceInTrunkGroup } from './voice-in-trunk-group.js';
import { serializeTrunkConfiguration, deserializeTrunkConfiguration } from '../nested/trunk-configuration.js';

export interface VoiceInTrunk {
  id: string;
  type: 'voice_in_trunks';
  name: string;
  priority: number;
  weight: number;
  cliFormat: CliFormat;
  cliPrefix: string;
  description: string;
  ringingTimeout: number;
  capacityLimit: string;
  configuration: TrunkConfiguration;
  createdAt: string;
  pop?: Pop | ResourceRef;
  voiceInTrunkGroup?: VoiceInTrunkGroup | ResourceRef;
}

export interface VoiceInTrunkWrite {
  name?: string;
  priority?: number;
  weight?: number;
  cliFormat?: CliFormat;
  cliPrefix?: string;
  description?: string;
  ringingTimeout?: number;
  capacityLimit?: string;
  configuration?: TrunkConfiguration;
  pop?: ResourceRef;
  voiceInTrunkGroup?: ResourceRef;
}

export const VOICE_IN_TRUNK_RESOURCE: ResourceConfig<VoiceInTrunk, VoiceInTrunkWrite> = {
  type: 'voice_in_trunks',
  path: 'voice_in_trunks',
  writableKeys: [
    'name',
    'priority',
    'weight',
    'cliFormat',
    'cliPrefix',
    'description',
    'ringingTimeout',
    'capacityLimit',
    'configuration',
    'pop',
    'voiceInTrunkGroup',
  ],
  serializeCustom(data, _method) {
    const result: Record<string, unknown> = {};
    for (const key of VOICE_IN_TRUNK_RESOURCE.writableKeys) {
      if (key in (data as Record<string, unknown>)) {
        result[key as string] = (data as Record<string, unknown>)[key];
      }
    }
    if (result.configuration) {
      result.configuration = serializeTrunkConfiguration(result.configuration as TrunkConfiguration);
    }
    return result;
  },
  deserializeCustom(data) {
    const config = (data as Record<string, unknown>).configuration;
    if (config && typeof config === 'object' && 'type' in config && 'attributes' in config) {
      return {
        configuration: deserializeTrunkConfiguration(config as Record<string, unknown>),
      } as Partial<VoiceInTrunk>;
    }
    return {};
  },
};
