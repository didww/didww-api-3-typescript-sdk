import { Environment } from './configuration.js';
import { DidwwApiError, DidwwClientError } from './errors.js';
import { buildQueryString, type QueryParams } from './query-params.js';
import type { HttpClient } from './repositories/read-only-repository.js';
import { ReadOnlyRepository } from './repositories/read-only-repository.js';
import { Repository } from './repositories/repository.js';
import { SingletonRepository } from './repositories/singleton-repository.js';
import { CreateOnlyRepository } from './repositories/create-only-repository.js';

import { COUNTRY_META, type Country } from './resources/country.js';
import { REGION_META, type Region } from './resources/region.js';
import { CITY_META, type City } from './resources/city.js';
import { AREA_META, type Area } from './resources/area.js';
import { POP_META, type Pop } from './resources/pop.js';
import { BALANCE_META, type Balance } from './resources/balance.js';
import { DID_GROUP_TYPE_META, type DidGroupType } from './resources/did-group-type.js';
import { DID_GROUP_META, type DidGroup } from './resources/did-group.js';
import { AVAILABLE_DID_META, type AvailableDid } from './resources/available-did.js';
import { NANPA_PREFIX_META, type NanpaPrefix } from './resources/nanpa-prefix.js';
import { PROOF_TYPE_META, type ProofType } from './resources/proof-type.js';
import { PUBLIC_KEY_META, type PublicKey } from './resources/public-key.js';
import { REQUIREMENT_META, type Requirement } from './resources/requirement.js';
import { SUPPORTING_DOCUMENT_TEMPLATE_META, type SupportingDocumentTemplate } from './resources/supporting-document-template.js';
import { STOCK_KEEPING_UNIT_META, type StockKeepingUnit } from './resources/stock-keeping-unit.js';
import { QTY_BASED_PRICING_META, type QtyBasedPricing } from './resources/qty-based-pricing.js';
import { CAPACITY_POOL_META, type CapacityPool, type CapacityPoolWrite } from './resources/capacity-pool.js';
import { VOICE_IN_TRUNK_META, type VoiceInTrunk, type VoiceInTrunkWrite } from './resources/voice-in-trunk.js';
import { VOICE_IN_TRUNK_GROUP_META, type VoiceInTrunkGroup, type VoiceInTrunkGroupWrite } from './resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_META, type VoiceOutTrunk, type VoiceOutTrunkWrite } from './resources/voice-out-trunk.js';
import { SHARED_CAPACITY_GROUP_META, type SharedCapacityGroup, type SharedCapacityGroupWrite } from './resources/shared-capacity-group.js';
import { DID_META, type Did, type DidWrite } from './resources/did.js';
import { ORDER_META, type Order, type OrderWrite } from './resources/order.js';
import { EXPORT_META, type Export, type ExportWrite } from './resources/export.js';
import { DID_RESERVATION_META, type DidReservation, type DidReservationWrite } from './resources/did-reservation.js';
import { ADDRESS_META, type Address, type AddressWrite } from './resources/address.js';
import { IDENTITY_META, type Identity, type IdentityWrite } from './resources/identity.js';
import { ENCRYPTED_FILE_META, type EncryptedFile } from './resources/encrypted-file.js';
import { ADDRESS_VERIFICATION_META, type AddressVerification, type AddressVerificationWrite } from './resources/address-verification.js';
import { PERMANENT_SUPPORTING_DOCUMENT_META, type PermanentSupportingDocument, type PermanentSupportingDocumentWrite } from './resources/permanent-supporting-document.js';
import { PROOF_META, type Proof, type ProofWrite } from './resources/proof.js';
import { REQUIREMENT_VALIDATION_META, type RequirementValidation, type RequirementValidationWrite } from './resources/requirement-validation.js';
import { VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_META, type VoiceOutTrunkRegenerateCredential, type VoiceOutTrunkRegenerateCredentialWrite } from './resources/voice-out-trunk-regenerate-credential.js';

export interface DidwwClientOptions {
  apiKey: string;
  environment?: Environment;
  baseUrl?: string;
}

export class DidwwClient implements HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: DidwwClientOptions) {
    if (!options.apiKey) {
      throw new DidwwClientError('apiKey is required');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || options.environment || Environment.SANDBOX;
    // Ensure no trailing slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  private headers(): Record<string, string> {
    return {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'Api-Key': this.apiKey,
    };
  }

  async get(path: string, params?: QueryParams): Promise<unknown> {
    const qs = buildQueryString(params);
    const url = `${this.baseUrl}/${path}${qs}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
    });
    return this.handleResponse(response);
  }

  async post(path: string, body: unknown, params?: QueryParams): Promise<unknown> {
    const qs = buildQueryString(params);
    const url = `${this.baseUrl}/${path}${qs}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async patch(path: string, body: unknown, params?: QueryParams): Promise<unknown> {
    const qs = buildQueryString(params);
    const url = `${this.baseUrl}/${path}${qs}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async delete(path: string): Promise<void> {
    const url = `${this.baseUrl}/${path}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (response.status === 204) return;
    if (!response.ok) {
      const body = await this.parseBody(response);
      throw new DidwwApiError(response.status, body);
    }
  }

  async uploadEncryptedFiles(fingerprint: string, files: Array<{ name: string; data: Buffer }>): Promise<string[]> {
    const formData = new FormData();
    formData.append('fingerprint', fingerprint);
    for (const file of files) {
      const blob = new Blob([file.data]);
      formData.append('items[]', blob, file.name);
    }
    const url = `${this.baseUrl}/encrypted_files`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
      },
      body: formData,
    });
    if (!response.ok) {
      const body = await this.parseBody(response);
      throw new DidwwApiError(response.status, body);
    }
    const result = await response.json() as Record<string, unknown>;
    if (!Array.isArray(result.ids)) {
      throw new DidwwClientError('Unexpected encrypted_files upload response');
    }
    return result.ids as string[];
  }

  async downloadExport(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Api-Key': this.apiKey },
    });
    if (!response.ok) {
      throw new DidwwApiError(response.status, { errors: [{ detail: 'Download failed' }] });
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async handleResponse(response: Response): Promise<unknown> {
    if (response.status === 204) return null;
    const body = await this.parseBody(response);
    if (!response.ok) {
      throw new DidwwApiError(response.status, body);
    }
    return body;
  }

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { errors: [{ detail: text }] };
    }
  }

  // Read-only repositories
  countries() { return new ReadOnlyRepository<Country>(this, COUNTRY_META); }
  regions() { return new ReadOnlyRepository<Region>(this, REGION_META); }
  cities() { return new ReadOnlyRepository<City>(this, CITY_META); }
  areas() { return new ReadOnlyRepository<Area>(this, AREA_META); }
  pops() { return new ReadOnlyRepository<Pop>(this, POP_META); }
  didGroupTypes() { return new ReadOnlyRepository<DidGroupType>(this, DID_GROUP_TYPE_META); }
  didGroups() { return new ReadOnlyRepository<DidGroup>(this, DID_GROUP_META); }
  availableDids() { return new ReadOnlyRepository<AvailableDid>(this, AVAILABLE_DID_META); }
  nanpaPrefixes() { return new ReadOnlyRepository<NanpaPrefix>(this, NANPA_PREFIX_META); }
  proofTypes() { return new ReadOnlyRepository<ProofType>(this, PROOF_TYPE_META); }
  publicKeys() { return new ReadOnlyRepository<PublicKey>(this, PUBLIC_KEY_META); }
  requirements() { return new ReadOnlyRepository<Requirement>(this, REQUIREMENT_META); }
  supportingDocumentTemplates() { return new ReadOnlyRepository<SupportingDocumentTemplate>(this, SUPPORTING_DOCUMENT_TEMPLATE_META); }
  stockKeepingUnits() { return new ReadOnlyRepository<StockKeepingUnit>(this, STOCK_KEEPING_UNIT_META); }
  qtyBasedPricings() { return new ReadOnlyRepository<QtyBasedPricing>(this, QTY_BASED_PRICING_META); }
  capacityPools() { return new Repository<CapacityPool, CapacityPoolWrite>(this, CAPACITY_POOL_META); }

  // Singleton
  balance() { return new SingletonRepository<Balance>(this, BALANCE_META); }

  // Full CRUD repositories
  voiceInTrunks() { return new Repository<VoiceInTrunk, VoiceInTrunkWrite>(this, VOICE_IN_TRUNK_META); }
  voiceInTrunkGroups() { return new Repository<VoiceInTrunkGroup, VoiceInTrunkGroupWrite>(this, VOICE_IN_TRUNK_GROUP_META); }
  voiceOutTrunks() { return new Repository<VoiceOutTrunk, VoiceOutTrunkWrite>(this, VOICE_OUT_TRUNK_META); }
  sharedCapacityGroups() { return new Repository<SharedCapacityGroup, SharedCapacityGroupWrite>(this, SHARED_CAPACITY_GROUP_META); }
  dids() { return new Repository<Did, DidWrite>(this, DID_META); }
  orders() { return new Repository<Order, OrderWrite>(this, ORDER_META); }
  exports() { return new Repository<Export, ExportWrite>(this, EXPORT_META); }
  didReservations() { return new Repository<DidReservation, DidReservationWrite>(this, DID_RESERVATION_META); }
  addresses() { return new Repository<Address, AddressWrite>(this, ADDRESS_META); }
  identities() { return new Repository<Identity, IdentityWrite>(this, IDENTITY_META); }
  encryptedFiles() { return new ReadOnlyRepository<EncryptedFile>(this, ENCRYPTED_FILE_META); }

  // Create-only repositories
  addressVerifications() { return new CreateOnlyRepository<AddressVerification, AddressVerificationWrite>(this, ADDRESS_VERIFICATION_META); }
  permanentSupportingDocuments() { return new CreateOnlyRepository<PermanentSupportingDocument, PermanentSupportingDocumentWrite>(this, PERMANENT_SUPPORTING_DOCUMENT_META); }
  proofs() { return new CreateOnlyRepository<Proof, ProofWrite>(this, PROOF_META); }
  requirementValidations() { return new CreateOnlyRepository<RequirementValidation, RequirementValidationWrite>(this, REQUIREMENT_VALIDATION_META); }
  voiceOutTrunkRegenerateCredentials() { return new CreateOnlyRepository<VoiceOutTrunkRegenerateCredential, VoiceOutTrunkRegenerateCredentialWrite>(this, VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_META); }
}
