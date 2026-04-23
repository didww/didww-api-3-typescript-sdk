import type {
  Codec,
  DiversionRelayPolicy,
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
  codecIds: Codec[];
  transportProtocolId?: TransportProtocol;
  authEnabled?: boolean;
  authUser?: string;
  authPassword?: string;
  authFromUser?: string;
  authFromDomain?: string;
  resolveRuri?: boolean;
  rxDtmfFormatId?: RxDtmfFormat;
  txDtmfFormatId?: TxDtmfFormat;
  sstEnabled?: boolean;
  sstMinTimer?: number;
  sstMaxTimer?: number;
  sstAccept_501?: boolean;
  sstSessionExpires?: number;
  sstRefreshMethodId?: SstRefreshMethod;
  sipTimerB?: number;
  dnsSrvFailoverTimer?: number;
  rtpPing?: boolean;
  forceSymmetricRtp?: boolean;
  reroutingDisconnectCodeIds?: ReroutingDisconnectCode[];
  maxTransfers?: number;
  max_30xRedirects?: number;
  mediaEncryptionMode?: MediaEncryptionMode;
  stirShakenMode?: StirShakenMode;
  allowedRtpIps?: string[];
  diversionRelayPolicy?: DiversionRelayPolicy;
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

export interface SerializedTrunkConfiguration {
  type: string;
  attributes: Record<string, unknown>;
}

export function serializeTrunkConfiguration(config: TrunkConfiguration): SerializedTrunkConfiguration {
  const { type, ...attributes } = config;
  return { type, attributes };
}

export function deserializeTrunkConfiguration(data: Record<string, unknown>): TrunkConfiguration {
  if (!data || typeof data !== 'object') return data as unknown as TrunkConfiguration;
  const type = data.type as string;
  const attributes = (data.attributes as Record<string, unknown>) || {};
  return { type, ...attributes } as TrunkConfiguration;
}
