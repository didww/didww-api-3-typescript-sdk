// Client
export { DidwwClient, type DidwwClientOptions } from './client.js';
export { Environment } from './configuration.js';
export { DidwwApiError, DidwwClientError, type JsonApiError } from './errors.js';
export { type QueryParams } from './query-params.js';

// Base
export { ref, type ResourceRef, type ResourceMeta } from './resources/base.js';

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
export type { Requirement } from './resources/requirement.js';
export type { SupportingDocumentTemplate } from './resources/supporting-document-template.js';
export type { StockKeepingUnit } from './resources/stock-keeping-unit.js';
export type { QtyBasedPricing } from './resources/qty-based-pricing.js';
export type { CapacityPool, CapacityPoolWrite } from './resources/capacity-pool.js';
export type { VoiceInTrunk, VoiceInTrunkWrite } from './resources/voice-in-trunk.js';
export type { VoiceInTrunkGroup, VoiceInTrunkGroupWrite } from './resources/voice-in-trunk-group.js';
export type { VoiceOutTrunk, VoiceOutTrunkWrite } from './resources/voice-out-trunk.js';
export type { SharedCapacityGroup, SharedCapacityGroupWrite } from './resources/shared-capacity-group.js';
export type { Did, DidWrite } from './resources/did.js';
export { assignVoiceInTrunk, assignVoiceInTrunkGroup } from './resources/did.js';
export type { Order, OrderWrite } from './resources/order.js';
export type { Export, ExportWrite } from './resources/export.js';
export type { DidReservation, DidReservationWrite } from './resources/did-reservation.js';
export type { Address, AddressWrite } from './resources/address.js';
export type { Identity, IdentityWrite } from './resources/identity.js';
export type { EncryptedFile } from './resources/encrypted-file.js';
export type { AddressVerification, AddressVerificationWrite } from './resources/address-verification.js';
export type {
  PermanentSupportingDocument,
  PermanentSupportingDocumentWrite,
} from './resources/permanent-supporting-document.js';
export type { Proof, ProofWrite } from './resources/proof.js';
export type { RequirementValidation, RequirementValidationWrite } from './resources/requirement-validation.js';
export type {
  VoiceOutTrunkRegenerateCredential,
  VoiceOutTrunkRegenerateCredentialWrite,
} from './resources/voice-out-trunk-regenerate-credential.js';

// Nested types
export type {
  TrunkConfiguration,
  SipConfiguration,
  H323Configuration,
  Iax2Configuration,
  PstnConfiguration,
} from './nested/trunk-configuration.js';
export {
  sipConfiguration,
  h323Configuration,
  iax2Configuration,
  pstnConfiguration,
} from './nested/trunk-configuration.js';

export type { OrderItem, DidOrderItem, CapacityOrderItem, GenericOrderItem } from './nested/order-item.js';
export { didOrderItem, capacityOrderItem } from './nested/order-item.js';

// Repository types
export type { ApiResponse, ListResponse } from './repositories/types.js';
export { ReadOnlyRepository } from './repositories/read-only-repository.js';
export { Repository } from './repositories/repository.js';
export { SingletonRepository } from './repositories/singleton-repository.js';
export { CreateOnlyRepository } from './repositories/create-only-repository.js';

// Encryption
export { encryptWithKeys, calculateFingerprint } from './encrypt.js';

// Callback
export { RequestValidator } from './callback/request-validator.js';
