import type {
  Codec,
  TransportProtocol,
  RxDtmfFormat,
  TxDtmfFormat,
  SstRefreshMethod,
  MediaEncryptionMode,
  StirShakenMode,
  ReroutingDisconnectCode,
} from '../enums.js';

export interface SipConfiguration {
  type: 'sip_configurations';
  username?: string;
  host: string;
  port: number;
  codec_ids: Codec[];
  transport_protocol_id?: TransportProtocol;
  auth_enabled?: boolean;
  auth_user?: string;
  auth_password?: string;
  auth_from_user?: string;
  auth_from_domain?: string;
  resolve_ruri?: boolean;
  rx_dtmf_format_id?: RxDtmfFormat;
  tx_dtmf_format_id?: TxDtmfFormat;
  sst_enabled?: boolean;
  sst_min_timer?: number;
  sst_max_timer?: number;
  sst_accept_501?: boolean;
  sst_session_expires?: number;
  sst_refresh_method_id?: SstRefreshMethod;
  sip_timer_b?: number;
  dns_srv_failover_timer?: number;
  rtp_ping?: boolean;
  force_symmetric_rtp?: boolean;
  rerouting_disconnect_code_ids?: ReroutingDisconnectCode[];
  max_transfers?: number;
  max_30x_redirects?: number;
  media_encryption_mode?: MediaEncryptionMode;
  stir_shaken_mode?: StirShakenMode;
  allowed_rtp_ips?: string[];
}

export interface PstnConfiguration {
  type: 'pstn_configurations';
  dst: string;
}

export type TrunkConfiguration = SipConfiguration | PstnConfiguration;

export function sipConfiguration(attrs: Omit<SipConfiguration, 'type'>): SipConfiguration {
  return { type: 'sip_configurations', ...attrs };
}

export function pstnConfiguration(attrs: Omit<PstnConfiguration, 'type'>): PstnConfiguration {
  return { type: 'pstn_configurations', ...attrs };
}

export function serializeTrunkConfiguration(config: TrunkConfiguration): Record<string, unknown> {
  const { type, ...attributes } = config;
  return { type, attributes };
}

export function deserializeTrunkConfiguration(data: Record<string, unknown>): TrunkConfiguration {
  if (!data || typeof data !== 'object') return data as any;
  const type = data.type as string;
  const attributes = (data.attributes as Record<string, unknown>) || {};
  return { type, ...attributes } as TrunkConfiguration;
}
