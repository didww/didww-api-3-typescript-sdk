// String enums

export enum CallbackMethod {
  POST = 'POST',
  GET = 'GET',
}

export enum AddressVerificationStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum ExportType {
  CDR_IN = 'cdr_in',
  CDR_OUT = 'cdr_out',
}

export enum ExportStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  COMPLETED = 'Completed',
}

export enum IdentityType {
  PERSONAL = 'Personal',
  BUSINESS = 'Business',
  ANY = 'Any',
}

export enum OrderStatus {
  PENDING = 'Pending',
  CANCELED = 'Canceled',
  COMPLETED = 'Completed',
}

export enum OnCliMismatchAction {
  SEND_ORIGINAL_CLI = 'send_original_cli',
  REJECT_CALL = 'reject_call',
  REPLACE_CLI = 'replace_cli',
}

export enum MediaEncryptionMode {
  DISABLED = 'disabled',
  SRTP_SDES = 'srtp_sdes',
  SRTP_DTLS = 'srtp_dtls',
  ZRTP = 'zrtp',
}

export enum DefaultDstAction {
  ALLOW_ALL = 'allow_all',
  REJECT_ALL = 'reject_all',
}

export enum VoiceOutTrunkStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export enum CliFormat {
  RAW = 'raw',
  E164 = 'e164',
  LOCAL = 'local',
}

export enum AreaLevel {
  WORLDWIDE = 'WorldWide',
  COUNTRY = 'Country',
  AREA = 'Area',
  CITY = 'City',
}

export enum Feature {
  VOICE = 'voice',
  VOICE_IN = 'voice_in',
  VOICE_OUT = 'voice_out',
  T38 = 't38',
  SMS = 'sms',
  SMS_IN = 'sms_in',
  SMS_OUT = 'sms_out',
}

export enum StirShakenMode {
  DISABLED = 'disabled',
  ORIGINAL = 'original',
  PAI = 'pai',
  ORIGINAL_PAI = 'original_pai',
  VERSTAT = 'verstat',
}

// Integer enums

export enum TransportProtocol {
  UDP = 1,
  TCP = 2,
  TLS = 3,
}

export enum RxDtmfFormat {
  RFC_2833 = 1,
  SIP_INFO = 2,
  RFC_2833_OR_SIP_INFO = 3,
}

export enum TxDtmfFormat {
  DISABLED = 1,
  RFC_2833 = 2,
  SIP_INFO_RELAY = 3,
  SIP_INFO_DTMF = 4,
}

export enum SstRefreshMethod {
  INVITE = 1,
  UPDATE = 2,
  UPDATE_FALLBACK_INVITE = 3,
}

export enum Codec {
  TELEPHONE_EVENT = 6,
  G723 = 7,
  G729 = 8,
  PCMU = 9,
  PCMA = 10,
  SPEEX = 12,
  GSM = 13,
  G726_32 = 14,
  G721 = 15,
  G726_24 = 16,
  G726_40 = 17,
  G726_16 = 18,
  L16 = 19,
}

export enum ConfigurationType {
  SIP = 'sip_configurations',
  H323 = 'h323_configurations',
  IAX2 = 'iax2_configurations',
  PSTN = 'pstn_configurations',
}

export enum OrderItemType {
  DID = 'did_order_items',
  CAPACITY = 'capacity_order_items',
}
