// Client
export { DidwwClient, type DidwwClientOptions, type FetchFunction } from './client.js';
export { Environment } from './configuration.js';
export { DidwwApiError, DidwwClientError, type JsonApiError } from './errors.js';
export { type QueryParams } from './query-params.js';

// Base
export { ref, isIncluded, type ResourceRef, type ResourceConfig, type Operation } from './resources/base.js';

// Enums
export * from './enums.js';

// Resources
export type { Country } from './resources/country.js';
export type { Region } from './resources/region.js';
export type { City } from './resources/city.js';
export type { Area } from './resources/area.js';
export type { Pop } from './resources/pop.js';
export type { Balance } from './resources/balance.js';
export type { DidGroupType } from './resources/did-group-type.js';
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

// Nested types
export type { TrunkConfiguration, SipConfiguration, PstnConfiguration } from './nested/trunk-configuration.js';
export { sipConfiguration, pstnConfiguration } from './nested/trunk-configuration.js';

export type { OrderItem, DidOrderItem, CapacityOrderItem, EmergencyOrderItem, GenericOrderItem } from './nested/order-item.js';

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
} from './status-helpers.js';

// Callback
export { RequestValidator } from './callback/request-validator.js';
