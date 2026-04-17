import { defineResource, type ResourceRef } from './base.js';
import type { OnCliMismatchAction, VoiceOutTrunkStatus, MediaEncryptionMode, DefaultDstAction } from '../enums.js';
import type { Did } from './did.js';
import type { AuthenticationMethod } from '../nested/authentication-method.js';
import {
  serializeAuthenticationMethod,
  deserializeAuthenticationMethod,
} from '../nested/authentication-method.js';
import { filterWritableKeys } from '../filter-writable-keys.js';

export interface VoiceOutTrunk {
  id: string;
  type: 'voice_out_trunks';
  name: string;
  onCliMismatchAction: OnCliMismatchAction;
  allowedRtpIps: string[];
  allowAnyDidAsCli: boolean;
  status: VoiceOutTrunkStatus;
  capacityLimit: number;
  thresholdAmount: string;
  mediaEncryptionMode: MediaEncryptionMode;
  defaultDstAction: DefaultDstAction;
  dstPrefixes: string[];
  forceSymmetricRtp: boolean;
  rtpPing: boolean;
  callbackUrl: string | null;
  thresholdReached: boolean;
  createdAt: string;
  externalReferenceId: string | null;
  emergencyEnableAll: boolean;
  rtpTimeout: number | null;
  authenticationMethod: AuthenticationMethod;
  defaultDid?: Did | ResourceRef;
  dids?: (Did | ResourceRef)[];
}

export interface VoiceOutTrunkWrite {
  name?: string;
  onCliMismatchAction?: OnCliMismatchAction;
  allowedRtpIps?: string[];
  allowAnyDidAsCli?: boolean;
  status?: VoiceOutTrunkStatus;
  capacityLimit?: number;
  thresholdAmount?: string;
  mediaEncryptionMode?: MediaEncryptionMode;
  defaultDstAction?: DefaultDstAction;
  dstPrefixes?: string[];
  forceSymmetricRtp?: boolean;
  rtpPing?: boolean;
  callbackUrl?: string | null;
  externalReferenceId?: string | null;
  emergencyEnableAll?: boolean;
  rtpTimeout?: number | null;
  authenticationMethod?: AuthenticationMethod;
  defaultDid?: ResourceRef | null;
  dids?: ResourceRef[];
}

const WRITABLE_KEYS = [
  'name',
  'onCliMismatchAction',
  'allowedRtpIps',
  'allowAnyDidAsCli',
  'status',
  'capacityLimit',
  'thresholdAmount',
  'mediaEncryptionMode',
  'defaultDstAction',
  'dstPrefixes',
  'forceSymmetricRtp',
  'rtpPing',
  'callbackUrl',
  'externalReferenceId',
  'emergencyEnableAll',
  'rtpTimeout',
  'authenticationMethod',
  'defaultDid',
  'dids',
] as const satisfies readonly (keyof VoiceOutTrunkWrite)[];

export const VOICE_OUT_TRUNK_RESOURCE = defineResource<VoiceOutTrunk, VoiceOutTrunkWrite>()({
  type: 'voice_out_trunks',
  path: 'voice_out_trunks',
  writableKeys: WRITABLE_KEYS,
  relationshipKeys: ['defaultDid', 'dids'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
  serializeCustom(data: VoiceOutTrunkWrite, _method: 'POST' | 'PATCH') {
    const result = filterWritableKeys(data, WRITABLE_KEYS);
    if (result.authenticationMethod) {
      // Serialize to { type, attributes } structure
      // camelToSnakeKeys in the serializer will handle key conversion
      result.authenticationMethod = serializeAuthenticationMethod(
        result.authenticationMethod as AuthenticationMethod,
      ) as unknown as AuthenticationMethod;
    }
    return result;
  },
  deserializeCustom(data: Record<string, unknown>) {
    const result: Partial<VoiceOutTrunk> = {};
    if (data.authenticationMethod && typeof data.authenticationMethod === 'object') {
      result.authenticationMethod = deserializeAuthenticationMethod(
        data.authenticationMethod as Record<string, unknown>,
      );
    }
    return result;
  },
});
