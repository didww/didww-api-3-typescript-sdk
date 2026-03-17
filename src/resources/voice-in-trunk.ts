import { defineResource, type ResourceRef } from './base.js';
import { filterWritableKeys } from '../filter-writable-keys.js';
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
  capacityLimit: number | null;
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
  capacityLimit?: number | null;
  configuration?: TrunkConfiguration;
  pop?: ResourceRef;
  voiceInTrunkGroup?: ResourceRef;
}

const WRITABLE_KEYS = [
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
] as const satisfies readonly (keyof VoiceInTrunkWrite)[];

export const VOICE_IN_TRUNK_RESOURCE = defineResource<VoiceInTrunk, VoiceInTrunkWrite>()({
  type: 'voice_in_trunks',
  path: 'voice_in_trunks',
  writableKeys: WRITABLE_KEYS,
  operations: ['list', 'find', 'create', 'update', 'remove'],
  relationshipKeys: ['pop', 'voiceInTrunkGroup'],
  serializeCustom(data) {
    const result = filterWritableKeys(data, WRITABLE_KEYS);
    if (result.configuration) {
      result.configuration = serializeTrunkConfiguration(result.configuration as TrunkConfiguration);
    }
    return result;
  },
  deserializeCustom(data: Record<string, unknown>) {
    const config = data.configuration;
    if (config && typeof config === 'object' && 'type' in config && 'attributes' in config) {
      return {
        configuration: deserializeTrunkConfiguration(config as Record<string, unknown>),
      } as Partial<VoiceInTrunk>;
    }
    return {};
  },
});
