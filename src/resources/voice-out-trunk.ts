import type { ResourceMeta, ResourceRef } from './base.js';
import type { OnCliMismatchAction, VoiceOutTrunkStatus, MediaEncryptionMode, DefaultDstAction } from '../enums.js';

export interface VoiceOutTrunk {
  id: string;
  type: 'voice_out_trunks';
  name: string;
  allowedSipIps: string[];
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
  username: string;
  password: string;
  thresholdReached: boolean;
  createdAt: string;
  defaultDid?: ResourceRef;
  dids?: ResourceRef[];
}

export interface VoiceOutTrunkWrite {
  name?: string;
  allowedSipIps?: string[];
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
  defaultDid?: ResourceRef | null;
  dids?: ResourceRef[];
}

export const VOICE_OUT_TRUNK_META: ResourceMeta<VoiceOutTrunk, VoiceOutTrunkWrite> = {
  type: 'voice_out_trunks',
  path: 'voice_out_trunks',
  writableKeys: [
    'name',
    'allowedSipIps',
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
    'defaultDid',
    'dids',
  ],
};
