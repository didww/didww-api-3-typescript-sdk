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

export enum ReroutingDisconnectCode {
  SIP_400_BAD_REQUEST = 56,
  SIP_401_UNAUTHORIZED = 57,
  SIP_402_PAYMENT_REQUIRED = 58,
  SIP_403_FORBIDDEN = 59,
  SIP_404_NOT_FOUND = 60,
  SIP_408_REQUEST_TIMEOUT = 64,
  SIP_409_CONFLICT = 65,
  SIP_410_GONE = 66,
  SIP_412_CONDITIONAL_REQUEST_FAILED = 67,
  SIP_413_REQUEST_ENTITY_TOO_LARGE = 68,
  SIP_414_REQUEST_URI_TOO_LONG = 69,
  SIP_415_UNSUPPORTED_MEDIA_TYPE = 70,
  SIP_416_UNSUPPORTED_URI_SCHEME = 71,
  SIP_417_UNKNOWN_RESOURCE_PRIORITY = 72,
  SIP_420_BAD_EXTENSION = 73,
  SIP_421_EXTENSION_REQUIRED = 74,
  SIP_422_SESSION_INTERVAL_TOO_SMALL = 75,
  SIP_423_INTERVAL_TOO_BRIEF = 76,
  SIP_424_BAD_LOCATION_INFORMATION = 77,
  SIP_428_USE_IDENTITY_HEADER = 78,
  SIP_429_PROVIDE_REFERRER_IDENTITY = 79,
  SIP_433_ANONYMITY_DISALLOWED = 80,
  SIP_436_BAD_IDENTITY_INFO = 81,
  SIP_437_UNSUPPORTED_CERTIFICATE = 82,
  SIP_438_INVALID_IDENTITY_HEADER = 83,
  SIP_480_TEMPORARILY_UNAVAILABLE = 84,
  SIP_482_LOOP_DETECTED = 86,
  SIP_483_TOO_MANY_HOPS = 87,
  SIP_484_ADDRESS_INCOMPLETE = 88,
  SIP_485_AMBIGUOUS = 89,
  SIP_486_BUSY_HERE = 90,
  SIP_487_REQUEST_TERMINATED = 91,
  SIP_488_NOT_ACCEPTABLE_HERE = 92,
  SIP_494_SECURITY_AGREEMENT_REQUIRED = 96,
  SIP_500_SERVER_INTERNAL_ERROR = 97,
  SIP_501_NOT_IMPLEMENTED = 98,
  SIP_502_BAD_GATEWAY = 99,
  SIP_503_SERVICE_UNAVAILABLE = 100,
  SIP_504_SERVER_TIME_OUT = 101,
  SIP_505_VERSION_NOT_SUPPORTED = 102,
  SIP_513_MESSAGE_TOO_LARGE = 103,
  SIP_580_PRECONDITION_FAILURE = 104,
  SIP_600_BUSY_EVERYWHERE = 105,
  SIP_603_DECLINE = 106,
  SIP_604_DOES_NOT_EXIST_ANYWHERE = 107,
  SIP_606_NOT_ACCEPTABLE = 108,
  RINGING_TIMEOUT = 1505,
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
  PSTN = 'pstn_configurations',
}

export enum OrderItemType {
  DID = 'did_order_items',
  CAPACITY = 'capacity_order_items',
}
