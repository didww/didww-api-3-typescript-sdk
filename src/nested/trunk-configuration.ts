export interface SipConfiguration {
  type: 'sip_configurations';
  username?: string;
  host: string;
  port: number;
  codec_ids: number[];
  transport_protocol_id?: number;
  auth_enabled?: boolean;
  auth_user?: string;
  auth_password?: string;
  auth_from_user?: string;
  auth_from_domain?: string;
  resolve_ruri?: boolean;
  rx_dtmf_format_id?: number;
  tx_dtmf_format_id?: number;
  sst_enabled?: boolean;
  sst_min_timer?: number;
  sst_max_timer?: number;
  sst_accept_501?: boolean;
  sst_session_expires?: number;
  sst_refresh_method_id?: number;
  sip_timer_b?: number;
  dns_srv_failover_timer?: number;
  rtp_ping?: boolean;
  force_symmetric_rtp?: boolean;
  rerouting_disconnect_code_ids?: number[];
  max_transfers?: number;
  max_30x_redirects?: number;
  media_encryption_mode?: string;
  stir_shaken_mode?: string;
  allowed_rtp_ips?: string[];
}

export interface H323Configuration {
  type: 'h323_configurations';
  dst: string;
  host: string;
  port: number;
  codec_ids: number[];
}

export interface Iax2Configuration {
  type: 'iax2_configurations';
  dst: string;
  host: string;
  port: number;
  codec_ids: number[];
  auth_enabled?: boolean;
  auth_user?: string;
  auth_password?: string;
}

export interface PstnConfiguration {
  type: 'pstn_configurations';
  dst: string;
}

export type TrunkConfiguration =
  | SipConfiguration
  | H323Configuration
  | Iax2Configuration
  | PstnConfiguration;

export function sipConfiguration(attrs: Omit<SipConfiguration, 'type'>): SipConfiguration {
  return { type: 'sip_configurations', ...attrs };
}

export function h323Configuration(attrs: Omit<H323Configuration, 'type'>): H323Configuration {
  return { type: 'h323_configurations', ...attrs };
}

export function iax2Configuration(attrs: Omit<Iax2Configuration, 'type'>): Iax2Configuration {
  return { type: 'iax2_configurations', ...attrs };
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
