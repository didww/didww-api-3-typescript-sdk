import type {
  Codec,
  DiversionRelayPolicy,
  DiversionInjectMode,
  NetworkProtocolPriority,
  TransportProtocol,
  RxDtmfFormat,
  TxDtmfFormat,
  SstRefreshMethod,
  MediaEncryptionMode,
  StirShakenMode,
  ReroutingDisconnectCode,
} from '../enums.js';

/**
 * SIP configuration for VoiceInTrunk.
 *
 * The shape is the "read shape" returned by the API: it contains every
 * attribute the server may emit, including the two server-generated read-only
 * SIP-registration credentials (`incomingAuthUsername`, `incomingAuthPassword`).
 *
 * For write payloads, prefer the {@link sipConfiguration} builder which accepts
 * a {@link SipConfigurationInput} type that excludes read-only fields. The
 * runtime serializer also strips `incomingAuthUsername` and
 * `incomingAuthPassword` from outgoing JSON:API attributes as a defensive
 * measure if a caller mutates a read-shape object and submits it back.
 */
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
  // -- API 2026-04-16 V3.5 attributes --
  /** Diversion header injection mode. (API 2026-04-16) */
  diversionInjectMode?: DiversionInjectMode;
  /** SIP network protocol priority. (API 2026-04-16) */
  networkProtocolPriority?: NetworkProtocolPriority;
  /**
   * Enables SIP registration. When true the API generates
   * `incomingAuthUsername` / `incomingAuthPassword`; the trunk's `port` must
   * be left blank. (API 2026-04-16)
   */
  enabledSipRegistration?: boolean;
  /**
   * When true, the trunk's R-URI uses the DID number. Requires
   * `enabledSipRegistration` to be true. (API 2026-04-16)
   */
  useDidInRuri?: boolean;
  /** Enables CNAM resolution for inbound calls on this trunk. (API 2026-04-16) */
  cnamLookup?: boolean;
  /**
   * Server-generated SIP authentication username. **Read-only:** present in
   * responses when `enabledSipRegistration` is true; the API rejects any
   * write attempt with `400 Param not allowed`. (API 2026-04-16)
   */
  incomingAuthUsername?: string | null;
  /**
   * Server-generated SIP authentication password. **Read-only:** present in
   * responses when `enabledSipRegistration` is true; the API rejects any
   * write attempt with `400 Param not allowed`. (API 2026-04-16)
   */
  incomingAuthPassword?: string | null;
}

/**
 * Read-only SIP configuration attributes returned by the server but never
 * accepted in write payloads. Stripped at serialization time.
 */
export const SIP_CONFIGURATION_READ_ONLY_KEYS = ['incomingAuthUsername', 'incomingAuthPassword'] as const;

/**
 * Input shape accepted by the {@link sipConfiguration} builder. Excludes
 * server-managed read-only fields (`incomingAuthUsername`,
 * `incomingAuthPassword`).
 */
export type SipConfigurationInput = Omit<SipConfiguration, 'type' | (typeof SIP_CONFIGURATION_READ_ONLY_KEYS)[number]>;

export interface PstnConfiguration {
  type: 'pstn_configurations';
  dst: string;
}

export type TrunkConfiguration = SipConfiguration | PstnConfiguration;

export function sipConfiguration(attrs: SipConfigurationInput): SipConfiguration {
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
  if (type === 'sip_configurations') {
    // Strip read-only keys so a caller mutating a read-shape object never
    // echoes server-generated SIP-registration credentials back to the API.
    for (const key of SIP_CONFIGURATION_READ_ONLY_KEYS) {
      if (key in attributes) {
        delete (attributes as Record<string, unknown>)[key];
      }
    }
  }
  return { type, attributes };
}

export function deserializeTrunkConfiguration(data: Record<string, unknown>): TrunkConfiguration {
  if (!data || typeof data !== 'object') return data as unknown as TrunkConfiguration;
  const type = data.type as string;
  const attributes = (data.attributes as Record<string, unknown>) || {};
  return { type, ...attributes } as TrunkConfiguration;
}
