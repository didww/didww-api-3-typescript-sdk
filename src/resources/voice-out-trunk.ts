import { defineResource, type ResourceRef } from './base.js';
import type {
  OnCliMismatchAction,
  VoiceOutTrunkStatus,
  MediaEncryptionMode,
  DefaultDstAction,
  VoiceOutCodec,
  IceMode,
  RtcpMuxMode,
  RtcpFeedbackMode,
} from '../enums.js';
import type { Did } from './did.js';
import type { AuthenticationMethod } from '../nested/authentication-method.js';
import { serializeAuthenticationMethod, deserializeAuthenticationMethod } from '../nested/authentication-method.js';
import { filterWritableKeys } from '../filter-writable-keys.js';

export interface VoiceOutTrunk {
  id: string;
  type: 'voice_out_trunks';
  name: string;
  onCliMismatchAction: OnCliMismatchAction;
  allowedRtpIps: string[];
  allowAnyDidAsCli: boolean;
  status: VoiceOutTrunkStatus | (string & {});
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
  /** Codecs offered on calls from the trunk, in priority order: the first has the highest priority. */
  codecs: VoiceOutCodec[];
  iceMode: IceMode;
  rtcpMuxMode: RtcpMuxMode;
  rtcpFeedbackMode: RtcpFeedbackMode;
  authenticationMethod: AuthenticationMethod;
  defaultDid?: Did | ResourceRef;
  dids?: (Did | ResourceRef)[];
  emergencyDids?: (Did | ResourceRef)[];
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
  /**
   * Codecs offered on calls from the trunk, in priority order: the first has the
   * highest priority. Defaults to `pcma`, `pcmu`, `telephone_event`.
   */
  codecs?: VoiceOutCodec[];
  /** ICE on calls from the trunk; defaults to `accept`. */
  iceMode?: IceMode;
  /** RTP and RTCP multiplexed on one port; defaults to `accept`. */
  rtcpMuxMode?: RtcpMuxMode;
  /** RTCP feedback (AVPF); defaults to `accept`. */
  rtcpFeedbackMode?: RtcpFeedbackMode;
  authenticationMethod?: AuthenticationMethod;
  defaultDid?: ResourceRef | null;
  dids?: ResourceRef[];
  emergencyDids?: ResourceRef[];
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
  'codecs',
  'iceMode',
  'rtcpMuxMode',
  'rtcpFeedbackMode',
  'authenticationMethod',
  'defaultDid',
  'dids',
  'emergencyDids',
] as const satisfies readonly (keyof VoiceOutTrunkWrite)[];

export const VOICE_OUT_TRUNK_RESOURCE = defineResource<VoiceOutTrunk, VoiceOutTrunkWrite>()({
  type: 'voice_out_trunks',
  path: 'voice_out_trunks',
  writableKeys: WRITABLE_KEYS,
  relationshipKeys: ['defaultDid', 'dids', 'emergencyDids'],
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
