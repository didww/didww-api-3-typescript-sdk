import type { ResourceMeta, ResourceRef } from './base.js';
import type { OnCliMismatchAction, VoiceOutTrunkStatus, MediaEncryptionMode, DefaultDstAction } from '../enums.js';

export interface VoiceOutTrunk {
  id: string;
  type: 'voice_out_trunks';
  name: string;
  allowed_sip_ips: string[];
  on_cli_mismatch_action: OnCliMismatchAction;
  allowed_rtp_ips: string[];
  allow_any_did_as_cli: boolean;
  status: VoiceOutTrunkStatus;
  capacity_limit: number;
  threshold_amount: string;
  media_encryption_mode: MediaEncryptionMode;
  default_dst_action: DefaultDstAction;
  dst_prefixes: string[];
  force_symmetric_rtp: boolean;
  rtp_ping: boolean;
  callback_url: string | null;
  username: string;
  password: string;
  threshold_reached: boolean;
  created_at: string;
  default_did?: ResourceRef;
  dids?: ResourceRef[];
}

export interface VoiceOutTrunkWrite {
  name?: string;
  allowed_sip_ips?: string[];
  on_cli_mismatch_action?: OnCliMismatchAction;
  allowed_rtp_ips?: string[];
  allow_any_did_as_cli?: boolean;
  status?: VoiceOutTrunkStatus;
  capacity_limit?: number;
  threshold_amount?: string;
  media_encryption_mode?: MediaEncryptionMode;
  default_dst_action?: DefaultDstAction;
  dst_prefixes?: string[];
  force_symmetric_rtp?: boolean;
  rtp_ping?: boolean;
  callback_url?: string | null;
  default_did?: ResourceRef | null;
  dids?: ResourceRef[];
}

export const VOICE_OUT_TRUNK_META: ResourceMeta<VoiceOutTrunk, VoiceOutTrunkWrite> = {
  type: 'voice_out_trunks',
  path: 'voice_out_trunks',
  writableKeys: [
    'name',
    'allowed_sip_ips',
    'on_cli_mismatch_action',
    'allowed_rtp_ips',
    'allow_any_did_as_cli',
    'status',
    'capacity_limit',
    'threshold_amount',
    'media_encryption_mode',
    'default_dst_action',
    'dst_prefixes',
    'force_symmetric_rtp',
    'rtp_ping',
    'callback_url',
    'default_did',
    'dids',
  ],
};
