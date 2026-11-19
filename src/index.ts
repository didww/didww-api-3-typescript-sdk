// Client
export { DidwwClient, type DidwwClientOptions } from './client.js';
export {
  Environment,
  DEFAULT_API_VERSION,
  Scope,
  ENVIRONMENT_ENDPOINTS,
  type EnvironmentEndpoints,
} from './configuration.js';
export {
  DidwwError,
  DidwwApiError,
  DidwwClientError,
  DidwwAuthError,
  AuthErrorKind,
  DidwwPricesError,
  PricesErrorKind,
  type DidwwAuthErrorInit,
  type DidwwPricesErrorInit,
  type JsonApiError,
} from './errors.js';
export { type QueryParams } from './query-params.js';
export { JsonNumber } from './json.js';
export { type DidwwLogger } from './logger.js';

// Access tokens
export { AccessToken, type AccessTokenData, type AccessTokenInit } from './auth/access-token.js';
export { MemoryTokenStore, type TokenStore, type MemoryTokenStoreOptions } from './auth/token-store.js';

// Prices services
export {
  PricesService,
  type PriceFile,
  type PricesRequestOptions,
  type VoiceInPriceFilters,
  type VoiceOutPriceFilters,
  type SmsPriceFilters,
} from './prices/service.js';
export {
  VoiceOutPriceCategory,
  type PriceLookup,
  type VoiceInPrice,
  type VoiceOutPrice,
  type SmsOutPrice,
  type SmsInPrice,
} from './prices/rows.js';
export { PriceFileReader, readPriceFile, type PriceFileRow, type PriceFileSource } from './prices/price-file-reader.js';

// Base
export { ref, isIncluded, type ResourceRef, type ResourceConfig, type Operation } from './resources/base.js';

// Enums
export * from './enums.js';

// Resources
export type { Country } from './resources/country.js';
export type { Region } from './resources/region.js';
export type { City } from './resources/city.js';
export type { Area } from './resources/area.js';
export type { Balance } from './resources/balance.js';
export type { DidGroup } from './resources/did-group.js';
export type { AvailableDid } from './resources/available-did.js';
export type { NanpaPrefix } from './resources/nanpa-prefix.js';
export type { ProofType } from './resources/proof-type.js';
export type { PublicKey } from './resources/public-key.js';
export type { AddressRequirement } from './resources/address-requirement.js';
export type { SupportingDocumentTemplate } from './resources/supporting-document-template.js';
export type { StockKeepingUnit } from './resources/stock-keeping-unit.js';
export type { QtyBasedPricing } from './resources/qty-based-pricing.js';
export type { CapacityPool, CapacityPoolWrite } from './resources/capacity-pool.js';
export type { VoiceInTrunk, VoiceInTrunkWrite } from './resources/voice-in-trunk.js';
export type { VoiceInTrunkGroup, VoiceInTrunkGroupWrite } from './resources/voice-in-trunk-group.js';
export type { VoiceOutTrunk, VoiceOutTrunkWrite } from './resources/voice-out-trunk.js';
export type { SharedCapacityGroup, SharedCapacityGroupWrite } from './resources/shared-capacity-group.js';
export type { Did, DidWrite } from './resources/did.js';
export type { Order, OrderWrite } from './resources/order.js';
export type { Export, ExportWrite, ExportFilters } from './resources/export.js';
export type { DidReservation, DidReservationWrite } from './resources/did-reservation.js';
export type { Address, AddressWrite } from './resources/address.js';
export type { Identity, IdentityWrite } from './resources/identity.js';
export type { EncryptedFile } from './resources/encrypted-file.js';
export type { DidHistory } from './resources/did-history.js';
export type { EmergencyRequirement } from './resources/emergency-requirement.js';
export type {
  EmergencyRequirementValidation,
  EmergencyRequirementValidationWrite,
} from './resources/emergency-requirement-validation.js';
export type { EmergencyCallingService } from './resources/emergency-calling-service.js';
export type { EmergencyVerification, EmergencyVerificationWrite } from './resources/emergency-verification.js';
export type { AddressVerification, AddressVerificationWrite } from './resources/address-verification.js';
export type {
  PermanentSupportingDocument,
  PermanentSupportingDocumentWrite,
} from './resources/permanent-supporting-document.js';
export type { Proof, ProofWrite } from './resources/proof.js';
export type {
  AddressRequirementValidation,
  AddressRequirementValidationWrite,
} from './resources/address-requirement-validation.js';
export type {
  VoiceOutTrunkRegenerateCredential,
  VoiceOutTrunkRegenerateCredentialWrite,
} from './resources/voice-out-trunk-regenerate-credential.js';
export type { SmsTrunk, SmsTrunkWrite } from './resources/sms-trunk.js';
export type { SmsTrunkGroup, SmsTrunkGroupWrite } from './resources/sms-trunk-group.js';
export type {
  SmsTrunkRegenerateCredential,
  SmsTrunkRegenerateCredentialWrite,
} from './resources/sms-trunk-regenerate-credential.js';
export type { SenderIdVerification, SenderIdVerificationWrite } from './resources/sender-id-verification.js';

// Nested types
export type { TrunkConfiguration, SipConfiguration, PstnConfiguration } from './nested/trunk-configuration.js';
export {
  sipConfiguration,
  pstnConfiguration,
  redactSipConfiguration,
  SIP_CONFIGURATION_SENSITIVE_KEYS,
} from './nested/trunk-configuration.js';

export type {
  SmsTrunkConfiguration,
  SmsToEmailConfiguration,
  SmsHttpInConfiguration,
  SmsHttpOutConfiguration,
  SmsSmppEsmeConfiguration,
  SmsSmppSmscConfiguration,
  GenericSmsTrunkConfiguration,
  SmsToEmailConfigurationInput,
  SmsHttpInConfigurationInput,
  SmsHttpOutConfigurationInput,
  SmsSmppEsmeConfigurationInput,
  SmsSmppSmscConfigurationInput,
} from './nested/sms-trunk-configuration.js';
export {
  smsToEmailConfiguration,
  smsHttpInConfiguration,
  smsHttpOutConfiguration,
  smsSmppEsmeConfiguration,
  smsSmppSmscConfiguration,
  genericSmsTrunkConfiguration,
  isSmsToEmail,
  isSmsHttpIn,
  isSmsHttpOut,
  isSmsSmppEsme,
  isSmsSmppSmsc,
  isGenericSmsTrunkConfiguration,
  redactSmsTrunkConfiguration,
  SMS_HTTP_IN_SENSITIVE_KEYS,
  SMS_HTTP_OUT_SENSITIVE_KEYS,
  SMS_SMPP_ESME_SENSITIVE_KEYS,
  SMS_SMPP_SMSC_SENSITIVE_KEYS,
} from './nested/sms-trunk-configuration.js';

export type {
  OrderItem,
  DidOrderItem,
  CapacityOrderItem,
  EmergencyOrderItem,
  GenericOrderItem,
} from './nested/order-item.js';

export type {
  AuthenticationMethod,
  IpOnlyAuthenticationMethod,
  CredentialsAndIpAuthenticationMethod,
  TwilioAuthenticationMethod,
  GenericAuthenticationMethod,
} from './nested/authentication-method.js';
export {
  ipOnlyAuthenticationMethod,
  credentialsAndIpAuthenticationMethod,
  twilioAuthenticationMethod,
  isIpOnly,
  isCredentialsAndIp,
  isTwilio,
  isGenericAuth,
  redactCredentialsAndIpAuthenticationMethod,
  CREDENTIALS_AND_IP_SENSITIVE_KEYS,
} from './nested/authentication-method.js';
export {
  didOrderItem,
  availableDidOrderItem,
  reservationDidOrderItem,
  capacityOrderItem,
  emergencyOrderItem,
} from './nested/order-item.js';

// Repository types
export { type HttpClient, Repository, createRepository } from './repositories/repository.js';
export type {
  ApiResponse,
  ListResponse,
  RepositoryFor,
  HasList,
  HasFind,
  HasSingletonFind,
  HasCreate,
  HasUpdate,
  HasRemove,
} from './repositories/types.js';

// Encryption
export { Encrypt, encryptWithKeys, calculateFingerprint } from './encrypt.js';

// Status helpers
export {
  isActive,
  isBlocked,
  isExportPending,
  isExportProcessing,
  isExportCompleted,
  isEcsActive,
  isEcsCanceled,
  isEcsChangesRequired,
  isEcsInProcess,
  isEcsNew,
  isEcsPendingUpdate,
  isAddressVerificationPending,
  isAddressVerificationApproved,
  isAddressVerificationRejected,
  isEmergencyVerificationPending,
  isEmergencyVerificationApproved,
  isEmergencyVerificationRejected,
  isOrderPending,
  isOrderCompleted,
  isOrderCanceled,
  isSenderIdVerificationActive,
  isSenderIdVerificationChangesRequired,
  isSenderIdVerificationClosed,
  isSenderIdVerificationClosingInProcess,
  isSenderIdVerificationInProcess,
  isSenderIdVerificationNew,
} from './status-helpers.js';

// Callback
export { RequestValidator } from './callback/request-validator.js';
