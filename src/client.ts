import { createRequire } from 'module';
import { Environment } from './configuration.js';
import { DidwwApiError, DidwwClientError } from './errors.js';
import { buildQueryString, type QueryParams } from './query-params.js';
import type { HttpClient } from './repositories/read-only-repository.js';
import { ReadOnlyRepository } from './repositories/read-only-repository.js';
import { Repository } from './repositories/repository.js';
import { SingletonRepository } from './repositories/singleton-repository.js';
import { CreateOnlyRepository } from './repositories/create-only-repository.js';

import { COUNTRY_RESOURCE, type Country } from './resources/country.js';
import { REGION_RESOURCE, type Region } from './resources/region.js';
import { CITY_RESOURCE, type City } from './resources/city.js';
import { AREA_RESOURCE, type Area } from './resources/area.js';
import { POP_RESOURCE, type Pop } from './resources/pop.js';
import { BALANCE_RESOURCE, type Balance } from './resources/balance.js';
import { DID_GROUP_TYPE_RESOURCE, type DidGroupType } from './resources/did-group-type.js';
import { DID_GROUP_RESOURCE, type DidGroup } from './resources/did-group.js';
import { AVAILABLE_DID_RESOURCE, type AvailableDid } from './resources/available-did.js';
import { NANPA_PREFIX_RESOURCE, type NanpaPrefix } from './resources/nanpa-prefix.js';
import { PROOF_TYPE_RESOURCE, type ProofType } from './resources/proof-type.js';
import { PUBLIC_KEY_RESOURCE, type PublicKey } from './resources/public-key.js';
import { REQUIREMENT_RESOURCE, type Requirement } from './resources/requirement.js';
import {
  SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE,
  type SupportingDocumentTemplate,
} from './resources/supporting-document-template.js';
import { CAPACITY_POOL_RESOURCE, type CapacityPool, type CapacityPoolWrite } from './resources/capacity-pool.js';
import { VOICE_IN_TRUNK_RESOURCE, type VoiceInTrunk, type VoiceInTrunkWrite } from './resources/voice-in-trunk.js';
import {
  VOICE_IN_TRUNK_GROUP_RESOURCE,
  type VoiceInTrunkGroup,
  type VoiceInTrunkGroupWrite,
} from './resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_RESOURCE, type VoiceOutTrunk, type VoiceOutTrunkWrite } from './resources/voice-out-trunk.js';
import {
  SHARED_CAPACITY_GROUP_RESOURCE,
  type SharedCapacityGroup,
  type SharedCapacityGroupWrite,
} from './resources/shared-capacity-group.js';
import { DID_RESOURCE, type Did, type DidWrite } from './resources/did.js';
import { ORDER_RESOURCE, type Order, type OrderWrite } from './resources/order.js';
import { EXPORT_RESOURCE, type Export, type ExportWrite } from './resources/export.js';
import {
  DID_RESERVATION_RESOURCE,
  type DidReservation,
  type DidReservationWrite,
} from './resources/did-reservation.js';
import { ADDRESS_RESOURCE, type Address, type AddressWrite } from './resources/address.js';
import { IDENTITY_RESOURCE, type Identity, type IdentityWrite } from './resources/identity.js';
import { ENCRYPTED_FILE_RESOURCE, type EncryptedFile } from './resources/encrypted-file.js';
import {
  ADDRESS_VERIFICATION_RESOURCE,
  type AddressVerification,
  type AddressVerificationWrite,
} from './resources/address-verification.js';
import {
  PERMANENT_SUPPORTING_DOCUMENT_RESOURCE,
  type PermanentSupportingDocument,
  type PermanentSupportingDocumentWrite,
} from './resources/permanent-supporting-document.js';
import { PROOF_RESOURCE, type Proof, type ProofWrite } from './resources/proof.js';
import {
  REQUIREMENT_VALIDATION_RESOURCE,
  type RequirementValidation,
  type RequirementValidationWrite,
} from './resources/requirement-validation.js';
import {
  VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE,
  type VoiceOutTrunkRegenerateCredential,
  type VoiceOutTrunkRegenerateCredentialWrite,
} from './resources/voice-out-trunk-regenerate-credential.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface DidwwClientOptions {
  apiKey: string;
  environment?: Environment;
  baseUrl?: string;
  timeout?: number;
  fetch?: FetchFunction;
}

export class DidwwClient implements HttpClient {
  private static readonly API_VERSION = '2022-05-10';
  private static readonly USER_AGENT = `didww-typescript-sdk/${pkg.version}`;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout?: number;
  private readonly _fetch: FetchFunction;

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
    this.timeout = options.timeout;
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private fetchOptions(): RequestInit {
    const opts: RequestInit = {};
    if (this.timeout !== undefined) {
      opts.signal = AbortSignal.timeout(this.timeout);
    }
    return opts;
  }

  private headers(path: string, jsonApi: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'X-DIDWW-API-Version': DidwwClient.API_VERSION,
      'User-Agent': DidwwClient.USER_AGENT,
    };
    if (jsonApi) {
      headers['Accept'] = 'application/vnd.api+json';
      headers['Content-Type'] = 'application/vnd.api+json';
    }
    if (!(path === PUBLIC_KEY_RESOURCE.path || path.startsWith(`${PUBLIC_KEY_RESOURCE.path}/`))) {
      headers['Api-Key'] = this.apiKey;
    }
    return headers;
  }

  async get(path: string, params?: QueryParams): Promise<unknown> {
    const qs = buildQueryString(params);
    const url = `${this.baseUrl}/${path}${qs}`;
    const response = await this._fetch(url, {
      method: 'GET',
      headers: this.headers(path),
      ...this.fetchOptions(),
    });
    return this.handleResponse(response);
  }

  async post(path: string, body: unknown, params?: QueryParams): Promise<unknown> {
    const qs = buildQueryString(params);
    const url = `${this.baseUrl}/${path}${qs}`;
    const response = await this._fetch(url, {
      method: 'POST',
      headers: this.headers(path),
      body: JSON.stringify(body),
      ...this.fetchOptions(),
    });
    return this.handleResponse(response);
  }

  async patch(path: string, body: unknown, params?: QueryParams): Promise<unknown> {
    const qs = buildQueryString(params);
    const url = `${this.baseUrl}/${path}${qs}`;
    const response = await this._fetch(url, {
      method: 'PATCH',
      headers: this.headers(path),
      body: JSON.stringify(body),
      ...this.fetchOptions(),
    });
    return this.handleResponse(response);
  }

  async delete(path: string): Promise<void> {
    const url = `${this.baseUrl}/${path}`;
    const response = await this._fetch(url, {
      method: 'DELETE',
      headers: this.headers(path),
      ...this.fetchOptions(),
    });
    if (response.status === 204) return;
    if (!response.ok) {
      const body = await this.parseBody(response);
      throw new DidwwApiError(response.status, body);
    }
  }

  async uploadEncryptedFiles(
    fingerprint: string,
    files: Array<{ data: Buffer; description?: string; filename?: string }>,
  ): Promise<string[]> {
    const formData = new FormData();
    formData.append('encrypted_files[encryption_fingerprint]', fingerprint);
    for (const file of files) {
      formData.append('encrypted_files[items][][description]', file.description || '');
      const blob = new Blob([file.data], { type: 'application/octet-stream' });
      formData.append('encrypted_files[items][][file]', blob, file.filename || 'file.enc');
    }
    const url = `${this.baseUrl}/encrypted_files`;
    const response = await this._fetch(url, {
      method: 'POST',
      headers: this.headers(ENCRYPTED_FILE_RESOURCE.path, false),
      body: formData,
      ...this.fetchOptions(),
    });
    if (!response.ok) {
      throw new DidwwApiError(response.status, { errors: [{ detail: 'Upload failed' }] });
    }
    const result = (await response.json()) as Record<string, unknown>;
    if (!Array.isArray(result.ids)) {
      throw new DidwwClientError('Unexpected encrypted_files upload response');
    }
    return result.ids as string[];
  }

  async downloadExport(url: string): Promise<Buffer> {
    const response = await this._fetch(url, {
      method: 'GET',
      headers: this.headers(EXPORT_RESOURCE.path, false),
      ...this.fetchOptions(),
    });
    if (!response.ok) {
      throw new DidwwApiError(response.status, { errors: [{ detail: 'Download failed' }] });
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async downloadAndDecompressExport(url: string): Promise<Buffer> {
    const { gunzip } = await import('node:zlib');
    const compressed = await this.downloadExport(url);
    return await new Promise<Buffer>((resolve, reject) => {
      gunzip(compressed, (err, result) => {
        if (err) {
          reject(new DidwwClientError(`Failed to decompress export: ${err.message}`));
        } else {
          resolve(result);
        }
      });
    });
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
  countries() {
    return new ReadOnlyRepository<Country>(this, COUNTRY_RESOURCE);
  }
  regions() {
    return new ReadOnlyRepository<Region>(this, REGION_RESOURCE);
  }
  cities() {
    return new ReadOnlyRepository<City>(this, CITY_RESOURCE);
  }
  areas() {
    return new ReadOnlyRepository<Area>(this, AREA_RESOURCE);
  }
  pops() {
    return new ReadOnlyRepository<Pop>(this, POP_RESOURCE);
  }
  didGroupTypes() {
    return new ReadOnlyRepository<DidGroupType>(this, DID_GROUP_TYPE_RESOURCE);
  }
  didGroups() {
    return new ReadOnlyRepository<DidGroup>(this, DID_GROUP_RESOURCE);
  }
  availableDids() {
    return new ReadOnlyRepository<AvailableDid>(this, AVAILABLE_DID_RESOURCE);
  }
  nanpaPrefixes() {
    return new ReadOnlyRepository<NanpaPrefix>(this, NANPA_PREFIX_RESOURCE);
  }
  proofTypes() {
    return new ReadOnlyRepository<ProofType>(this, PROOF_TYPE_RESOURCE);
  }
  publicKeys() {
    return new ReadOnlyRepository<PublicKey>(this, PUBLIC_KEY_RESOURCE);
  }
  requirements() {
    return new ReadOnlyRepository<Requirement>(this, REQUIREMENT_RESOURCE);
  }
  supportingDocumentTemplates() {
    return new ReadOnlyRepository<SupportingDocumentTemplate>(this, SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE);
  }
  // stockKeepingUnits and qtyBasedPricings have no standalone endpoints.
  // Access them via include on didGroups and capacityPools respectively.
  capacityPools() {
    return new Repository<CapacityPool, CapacityPoolWrite>(this, CAPACITY_POOL_RESOURCE);
  }

  // Singleton
  balance() {
    return new SingletonRepository<Balance>(this, BALANCE_RESOURCE);
  }

  // Full CRUD repositories
  voiceInTrunks() {
    return new Repository<VoiceInTrunk, VoiceInTrunkWrite>(this, VOICE_IN_TRUNK_RESOURCE);
  }
  voiceInTrunkGroups() {
    return new Repository<VoiceInTrunkGroup, VoiceInTrunkGroupWrite>(this, VOICE_IN_TRUNK_GROUP_RESOURCE);
  }
  voiceOutTrunks() {
    return new Repository<VoiceOutTrunk, VoiceOutTrunkWrite>(this, VOICE_OUT_TRUNK_RESOURCE);
  }
  sharedCapacityGroups() {
    return new Repository<SharedCapacityGroup, SharedCapacityGroupWrite>(this, SHARED_CAPACITY_GROUP_RESOURCE);
  }
  dids() {
    return new Repository<Did, DidWrite>(this, DID_RESOURCE);
  }
  orders() {
    return new Repository<Order, OrderWrite>(this, ORDER_RESOURCE);
  }
  exports() {
    return new Repository<Export, ExportWrite>(this, EXPORT_RESOURCE);
  }
  didReservations() {
    return new Repository<DidReservation, DidReservationWrite>(this, DID_RESERVATION_RESOURCE);
  }
  addresses() {
    return new Repository<Address, AddressWrite>(this, ADDRESS_RESOURCE);
  }
  identities() {
    return new Repository<Identity, IdentityWrite>(this, IDENTITY_RESOURCE);
  }
  encryptedFiles() {
    return new Repository<EncryptedFile>(this, ENCRYPTED_FILE_RESOURCE);
  }

  // Create-only repositories
  addressVerifications() {
    return new CreateOnlyRepository<AddressVerification, AddressVerificationWrite>(this, ADDRESS_VERIFICATION_RESOURCE);
  }
  permanentSupportingDocuments() {
    return new CreateOnlyRepository<PermanentSupportingDocument, PermanentSupportingDocumentWrite>(
      this,
      PERMANENT_SUPPORTING_DOCUMENT_RESOURCE,
    );
  }
  proofs() {
    return new CreateOnlyRepository<Proof, ProofWrite>(this, PROOF_RESOURCE);
  }
  requirementValidations() {
    return new CreateOnlyRepository<RequirementValidation, RequirementValidationWrite>(
      this,
      REQUIREMENT_VALIDATION_RESOURCE,
    );
  }
  voiceOutTrunkRegenerateCredentials() {
    return new CreateOnlyRepository<VoiceOutTrunkRegenerateCredential, VoiceOutTrunkRegenerateCredentialWrite>(
      this,
      VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE,
    );
  }
}
