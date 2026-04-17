import { createRequire } from 'module';
import { Environment } from './configuration.js';
import { DidwwApiError, DidwwClientError } from './errors.js';
import { buildQueryString, type QueryParams } from './query-params.js';
import { type HttpClient, createRepository } from './repositories/repository.js';

import { COUNTRY_RESOURCE } from './resources/country.js';
import { REGION_RESOURCE } from './resources/region.js';
import { CITY_RESOURCE } from './resources/city.js';
import { AREA_RESOURCE } from './resources/area.js';
import { POP_RESOURCE } from './resources/pop.js';
import { BALANCE_RESOURCE } from './resources/balance.js';
import { DID_GROUP_TYPE_RESOURCE } from './resources/did-group-type.js';
import { DID_GROUP_RESOURCE } from './resources/did-group.js';
import { AVAILABLE_DID_RESOURCE } from './resources/available-did.js';
import { NANPA_PREFIX_RESOURCE } from './resources/nanpa-prefix.js';
import { PROOF_TYPE_RESOURCE } from './resources/proof-type.js';
import { PUBLIC_KEY_RESOURCE } from './resources/public-key.js';
import { ADDRESS_REQUIREMENT_RESOURCE } from './resources/address-requirement.js';
import { SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE } from './resources/supporting-document-template.js';
import { CAPACITY_POOL_RESOURCE } from './resources/capacity-pool.js';
import { VOICE_IN_TRUNK_RESOURCE } from './resources/voice-in-trunk.js';
import { VOICE_IN_TRUNK_GROUP_RESOURCE } from './resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_RESOURCE } from './resources/voice-out-trunk.js';
import { SHARED_CAPACITY_GROUP_RESOURCE } from './resources/shared-capacity-group.js';
import { DID_RESOURCE } from './resources/did.js';
import { ORDER_RESOURCE } from './resources/order.js';
import { EXPORT_RESOURCE } from './resources/export.js';
import { DID_RESERVATION_RESOURCE } from './resources/did-reservation.js';
import { ADDRESS_RESOURCE } from './resources/address.js';
import { IDENTITY_RESOURCE } from './resources/identity.js';
import { ENCRYPTED_FILE_RESOURCE } from './resources/encrypted-file.js';
import { ADDRESS_VERIFICATION_RESOURCE } from './resources/address-verification.js';
import { PERMANENT_SUPPORTING_DOCUMENT_RESOURCE } from './resources/permanent-supporting-document.js';
import { PROOF_RESOURCE } from './resources/proof.js';
import { ADDRESS_REQUIREMENT_VALIDATION_RESOURCE } from './resources/address-requirement-validation.js';
import { VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE } from './resources/voice-out-trunk-regenerate-credential.js';
import { DID_HISTORY_RESOURCE } from './resources/did-history.js';
import { EMERGENCY_REQUIREMENT_RESOURCE } from './resources/emergency-requirement.js';

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
  private static readonly API_VERSION = '2026-04-16';
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

  async uploadEncryptedFile(
    fingerprint: string,
    file: { data: Buffer; description?: string; filename?: string },
  ): Promise<string> {
    const formData = new FormData();
    formData.append('encrypted_files[encryption_fingerprint]', fingerprint);
    formData.append('encrypted_files[description]', file.description || '');
    const blob = new Blob([file.data], { type: 'application/octet-stream' });
    formData.append('encrypted_files[file]', blob, file.filename || 'file.enc');
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
    const data = result.data as Record<string, unknown> | undefined;
    if (!data || typeof data.id !== 'string') {
      throw new DidwwClientError('Unexpected encrypted_files upload response');
    }
    return data.id;
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
    return createRepository(this, COUNTRY_RESOURCE);
  }
  regions() {
    return createRepository(this, REGION_RESOURCE);
  }
  cities() {
    return createRepository(this, CITY_RESOURCE);
  }
  areas() {
    return createRepository(this, AREA_RESOURCE);
  }
  pops() {
    return createRepository(this, POP_RESOURCE);
  }
  didGroupTypes() {
    return createRepository(this, DID_GROUP_TYPE_RESOURCE);
  }
  didGroups() {
    return createRepository(this, DID_GROUP_RESOURCE);
  }
  availableDids() {
    return createRepository(this, AVAILABLE_DID_RESOURCE);
  }
  nanpaPrefixes() {
    return createRepository(this, NANPA_PREFIX_RESOURCE);
  }
  proofTypes() {
    return createRepository(this, PROOF_TYPE_RESOURCE);
  }
  publicKeys() {
    return createRepository(this, PUBLIC_KEY_RESOURCE);
  }
  addressRequirements() {
    return createRepository(this, ADDRESS_REQUIREMENT_RESOURCE);
  }
  supportingDocumentTemplates() {
    return createRepository(this, SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE);
  }

  // Singleton
  balance() {
    return createRepository(this, BALANCE_RESOURCE);
  }

  // Full CRUD repositories

  // stockKeepingUnits and qtyBasedPricings have no standalone endpoints.
  // Access them via include on didGroups and capacityPools respectively.
  capacityPools() {
    return createRepository(this, CAPACITY_POOL_RESOURCE);
  }
  voiceInTrunks() {
    return createRepository(this, VOICE_IN_TRUNK_RESOURCE);
  }
  voiceInTrunkGroups() {
    return createRepository(this, VOICE_IN_TRUNK_GROUP_RESOURCE);
  }
  voiceOutTrunks() {
    return createRepository(this, VOICE_OUT_TRUNK_RESOURCE);
  }
  sharedCapacityGroups() {
    return createRepository(this, SHARED_CAPACITY_GROUP_RESOURCE);
  }
  dids() {
    return createRepository(this, DID_RESOURCE);
  }
  orders() {
    return createRepository(this, ORDER_RESOURCE);
  }
  exports() {
    return createRepository(this, EXPORT_RESOURCE);
  }
  didReservations() {
    return createRepository(this, DID_RESERVATION_RESOURCE);
  }
  addresses() {
    return createRepository(this, ADDRESS_RESOURCE);
  }
  identities() {
    return createRepository(this, IDENTITY_RESOURCE);
  }
  encryptedFiles() {
    return createRepository(this, ENCRYPTED_FILE_RESOURCE);
  }

  // Create-only repositories
  addressVerifications() {
    return createRepository(this, ADDRESS_VERIFICATION_RESOURCE);
  }
  permanentSupportingDocuments() {
    return createRepository(this, PERMANENT_SUPPORTING_DOCUMENT_RESOURCE);
  }
  proofs() {
    return createRepository(this, PROOF_RESOURCE);
  }
  addressRequirementValidations() {
    return createRepository(this, ADDRESS_REQUIREMENT_VALIDATION_RESOURCE);
  }
  voiceOutTrunkRegenerateCredentials() {
    return createRepository(this, VOICE_OUT_TRUNK_REGENERATE_CREDENTIAL_RESOURCE);
  }
  didHistory() {
    return createRepository(this, DID_HISTORY_RESOURCE);
  }
  emergencyRequirements() {
    return createRepository(this, EMERGENCY_REQUIREMENT_RESOURCE);
  }
}
