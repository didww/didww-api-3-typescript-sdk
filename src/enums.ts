export enum TransportProtocol {
  UDP = 'UDP',
  TCP = 'TCP',
  TLS = 'TLS',
}

export enum Codec {
  G711A = 9,
  G711U = 10,
  G723 = 4,
  G729 = 18,
  OPUS = 111,
  G722 = 100,
  T38 = 128,
}

export enum CliFormat {
  RAW = 'raw',
  E164 = 'e164',
  LOCAL = 'local',
  NATIONAL = 'national',
}

export enum CliFormatType {
  DISPLAY_NAME = 'display_name',
  RPID = 'rpid',
  PAID = 'paid',
}

export enum CapacityLimit {
  SHARED = 'shared',
  METERED = 'metered',
}

export enum MediaMode {
  DIRECT = 'direct',
  RELAY = 'relay',
}

export enum DidType {
  LOCAL = 'local',
  TOLLFREE = 'toll_free',
  MOBILE = 'mobile',
  NATIONAL = 'national',
  SHARED_COST = 'shared_cost',
}

export enum OrderStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export enum TerminationStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

export enum AuthMethod {
  IP = 'ip',
  CREDENTIAL = 'credential',
}

export enum RtpPingEnabled {
  DISABLED = 'disabled',
  ENABLED = 'enabled',
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

export enum TrunkGroupRoutingMode {
  FAILOVER = 'Failover',
  BALANCED = 'Balanced',
}

export enum AddressVerificationStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum ExportStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
}
