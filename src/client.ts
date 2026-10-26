import type http from 'node:http';
import { inspect } from 'node:util';
import zlib from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import {
  Audience,
  DEFAULT_API_VERSION,
  Environment,
  ENVIRONMENT_ENDPOINTS,
  trimTrailingSlash,
  validateApiKey,
  validateApiVersion,
  validateEnvironment,
  validateScope,
  validateServiceUrl,
  validateTimeout,
  type Scope,
} from './configuration.js';
import { DidwwApiError, DidwwClientError, DidwwError } from './errors.js';
import { normalizeNumbers, parseJson, stringifyJson } from './json.js';
import { isLogger, SILENT_LOGGER, type DidwwLogger } from './logger.js';
import { buildQueryString, type QueryParams } from './query-params.js';
import { type HttpClient, createRepository } from './repositories/repository.js';
import { DEFAULT_TOKEN_STORE, isTokenStore, type TokenStore } from './auth/token-store.js';
import { TokenProvider } from './auth/token-provider.js';
import { TESTING, type TestingHooks } from './auth/state.js';
import { writeFileAtomically } from './http/atomic-file.js';
import { feedGunzip } from './gzip.js';
import {
  BodyReadError,
  contentCoding,
  decodeBody,
  rawChunks,
  readAll,
  readErrorBody,
  writeIntoStream,
} from './http/body.js';
import {
  contentLength,
  describeFailure,
  formatOrigin,
  originOf,
  sameOrigin,
  secureRandom,
  Transport,
  type Method,
  type SendOptions,
} from './http/transport.js';
import {
  PRICE_LISTS,
  PricesService,
  type PricesContext,
  type SmsPriceFilters,
  type VoiceInPriceFilters,
  type VoiceOutPriceFilters,
} from './prices/service.js';
import type { SmsInPrice, SmsOutPrice, VoiceInPrice, VoiceOutPrice } from './prices/rows.js';

import { COUNTRY_RESOURCE } from './resources/country.js';
import { REGION_RESOURCE } from './resources/region.js';
import { CITY_RESOURCE } from './resources/city.js';
import { AREA_RESOURCE } from './resources/area.js';
import { BALANCE_RESOURCE } from './resources/balance.js';
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
import { EMERGENCY_REQUIREMENT_VALIDATION_RESOURCE } from './resources/emergency-requirement-validation.js';
import { EMERGENCY_CALLING_SERVICE_RESOURCE } from './resources/emergency-calling-service.js';
import { EMERGENCY_VERIFICATION_RESOURCE } from './resources/emergency-verification.js';
import { SMS_TRUNK_RESOURCE } from './resources/sms-trunk.js';
import { SMS_TRUNK_GROUP_RESOURCE } from './resources/sms-trunk-group.js';
import { SMS_TRUNK_REGENERATE_CREDENTIAL_RESOURCE } from './resources/sms-trunk-regenerate-credential.js';
import { SENDER_ID_VERIFICATION_RESOURCE } from './resources/sender-id-verification.js';

// Injected at build time by tsup's `define` (see tsup.config.ts). Falls
// back to a sentinel for source consumers (vitest, ts-node) that don't
// run through tsup.
declare const __SDK_VERSION__: string;
const SDK_VERSION = typeof __SDK_VERSION__ === 'string' ? __SDK_VERSION__ : '0.0.0-source';
const USER_AGENT = `didww-typescript-sdk/${SDK_VERSION}`;
const JSONAPI_MEDIA_TYPE = 'application/vnd.api+json';

export interface DidwwClientOptions {
  /** The API key: printable ASCII without spaces. It is sent only to the token service. */
  apiKey: string;
  /** `Environment.SANDBOX` (default) or `Environment.PRODUCTION`. */
  environment?: Environment;
  /** The JSON:API base URL; defaults to the environment's. */
  baseUrl?: string;
  /** The API version requested for access tokens, `2026-10-22` or later. */
  apiVersion?: string;
  /** The scope requested for access tokens; when omitted or null none is requested and the token service grants `full`. */
  scope?: Scope | null;
  /** Where access tokens are kept; defaults to one in-memory store shared by every client of the process. */
  tokenStore?: TokenStore;
  /** Receives warnings and debug messages about access tokens; silent by default. */
  logger?: DidwwLogger;
  /** The token service base URL; defaults to the environment's. */
  authUrl?: string;
  /** The Voice IN prices service base URL; defaults to the environment's. */
  voiceInPricesUrl?: string;
  /** The Voice OUT prices service base URL; defaults to the environment's. */
  voiceOutPricesUrl?: string;
  /** The SMS prices service base URL; defaults to the environment's. */
  smsPricesUrl?: string;
  /**
   * Milliseconds to open a connection, counted from the request: the TCP
   * connection, the tunnel of a proxy agent and the TLS handshake, and with an
   * agent that caps `maxSockets` the wait for a free socket; 10 000 by default,
   * null for no limit.
   */
  connectTimeout?: number | null;
  /** Milliseconds to wait for the answer and for each part of its body; 60 000 by default, null for no limit. */
  readTimeout?: number | null;
  /** Milliseconds for a whole HTTP exchange, body included; no limit by default. It also cuts long downloads. */
  timeout?: number | null;
  /** The agent of every request (for example a proxy agent, or one with keep-alive); Node's global agents by default. */
  agent?: http.Agent;
}

type Destination = string | NodeJS.WritableStream;

/**
 * Client of the DIDWW API.
 *
 * Requests carry an access token that the client obtains for its API key from
 * the token service and keeps in `tokenStore`; the API key itself is sent only
 * to the token service. One client may serve any number of concurrent calls.
 */
export class DidwwClient implements HttpClient {
  readonly #environment: Environment;
  readonly #baseUrl: string;
  readonly #authUrl: string;
  readonly #voiceInPricesUrl: string;
  readonly #voiceOutPricesUrl: string;
  readonly #smsPricesUrl: string;
  readonly #apiVersion: string;
  readonly #scope: Scope | null;
  readonly #tokenStore: TokenStore;
  readonly #readTimeout: number | null;
  readonly #transport: Transport;
  readonly #tokens: TokenProvider;
  readonly #prices: PricesContext;

  constructor(options: DidwwClientOptions) {
    if (options === null || typeof options !== 'object') {
      throw new DidwwClientError('apiKey is required');
    }
    if ((options as { fetch?: unknown }).fetch !== undefined) {
      throw new DidwwClientError(
        'the fetch option was removed in 4.0.0; pass an http.Agent as agent (for a proxy, e.g. https-proxy-agent)',
      );
    }
    const apiKey = validateApiKey(options.apiKey);
    this.#environment = validateEnvironment(options.environment ?? Environment.SANDBOX);
    this.#apiVersion = validateApiVersion(options.apiVersion ?? DEFAULT_API_VERSION);
    this.#scope = validateScope(options.scope);
    const connect = validateTimeout('connectTimeout', options.connectTimeout, 10_000);
    this.#readTimeout = validateTimeout('readTimeout', options.readTimeout, 60_000);
    const total = validateTimeout('timeout', options.timeout, null);

    const endpoints = ENVIRONMENT_ENDPOINTS[this.#environment];
    this.#baseUrl = trimTrailingSlash(validateServiceUrl('API base', options.baseUrl || this.#environment));
    this.#authUrl = trimTrailingSlash(validateServiceUrl('Token service', options.authUrl || endpoints.auth));
    this.#voiceInPricesUrl = validateServiceUrl('Voice IN prices', options.voiceInPricesUrl || endpoints.voiceInPrices);
    this.#voiceOutPricesUrl = validateServiceUrl(
      'Voice OUT prices',
      options.voiceOutPricesUrl || endpoints.voiceOutPrices,
    );
    this.#smsPricesUrl = validateServiceUrl('SMS prices', options.smsPricesUrl || endpoints.smsPrices);

    if (options.tokenStore !== undefined && !isTokenStore(options.tokenStore)) {
      throw new DidwwClientError('tokenStore must provide get, set and delete');
    }
    this.#tokenStore = options.tokenStore ?? DEFAULT_TOKEN_STORE;
    if (options.logger !== undefined && !isLogger(options.logger)) {
      throw new DidwwClientError('logger must be an object with debug, info, warn or error methods');
    }
    const logger = options.logger ?? SILENT_LOGGER;
    const agent = options.agent;
    if (
      agent !== undefined &&
      (agent === null || typeof (agent as { addRequest?: unknown }).addRequest !== 'function')
    ) {
      throw new DidwwClientError('agent must be an http.Agent');
    }

    this.#transport = new Transport(agent, { connect, read: this.#readTimeout, total }, USER_AGENT);
    const hooks = (options as { [TESTING]?: TestingHooks })[TESTING];
    this.#tokens = new TokenProvider({
      transport: this.#transport,
      authUrl: this.#authUrl,
      apiKey,
      apiVersion: this.#apiVersion,
      scope: this.#scope,
      store: this.#tokenStore,
      logger,
      hooks,
    });
    this.#prices = Object.freeze({
      transport: this.#transport,
      tokens: this.#tokens,
      readTimeout: this.#readTimeout,
      urls: Object.freeze({
        voiceIn: this.#voiceInPricesUrl,
        voiceOut: this.#voiceOutPricesUrl,
        sms: this.#smsPricesUrl,
      }),
      sleep: hooks?.sleep ?? ((ms: number) => delay(ms)),
      random: hooks?.random ?? secureRandom,
    });
  }

  get environment(): Environment {
    return this.#environment;
  }

  /** The JSON:API base URL, without a trailing slash. */
  get baseUrl(): string {
    return this.#baseUrl;
  }

  /** The API version requested for access tokens. */
  get apiVersion(): string {
    return this.#apiVersion;
  }

  /** The scope requested for access tokens, or null. */
  get scope(): Scope | null {
    return this.#scope;
  }

  /** The token service base URL. */
  get authUrl(): string {
    return this.#authUrl;
  }

  get voiceInPricesUrl(): string {
    return this.#voiceInPricesUrl;
  }

  get voiceOutPricesUrl(): string {
    return this.#voiceOutPricesUrl;
  }

  get smsPricesUrl(): string {
    return this.#smsPricesUrl;
  }

  get tokenStore(): TokenStore {
    return this.#tokenStore;
  }

  toJSON(): Record<string, unknown> {
    return {
      environment: this.#environment,
      baseUrl: this.#baseUrl,
      authUrl: this.#authUrl,
      apiVersion: this.#apiVersion,
      scope: this.#scope,
    };
  }

  [inspect.custom](): string {
    return `DidwwClient ${inspect(this.toJSON(), { breakLength: Infinity })}`;
  }

  // --- JSON:API ---

  async get(path: string, params?: QueryParams): Promise<unknown> {
    return this.#requestJson('GET', path, params);
  }

  async post(path: string, body: unknown, params?: QueryParams): Promise<unknown> {
    return this.#requestJson('POST', path, params, body);
  }

  async patch(path: string, body: unknown, params?: QueryParams): Promise<unknown> {
    return this.#requestJson('PATCH', path, params, body);
  }

  async delete(path: string): Promise<void> {
    await this.#requestJson('DELETE', path);
  }

  async #requestJson(method: Method, path: string, params?: QueryParams, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { Accept: JSONAPI_MEDIA_TYPE, 'Accept-Encoding': 'gzip' };
    let payload: Buffer | undefined;
    if (body !== undefined) {
      payload = Buffer.from(stringifyJson(body), 'utf8');
      headers['Content-Type'] = JSONAPI_MEDIA_TYPE;
    }
    const audience =
      path === PUBLIC_KEY_RESOURCE.path || path.startsWith(`${PUBLIC_KEY_RESOURCE.path}/`) ? null : Audience.API;
    const what = `${method} ${path}`;
    const res = await this.#send({ method, url: this.#url(path, params), headers, body: payload }, audience, what);
    return this.#readJson(res, what);
  }

  #url(path: string, params?: QueryParams): URL {
    return new URL(`${this.#baseUrl}/${path}${buildQueryString(params)}`);
  }

  async #send(options: SendOptions, audience: string | null, what: string): Promise<http.IncomingMessage> {
    try {
      return await this.#transport.sendAuthorized(options, audience, this.#tokens);
    } catch (e) {
      if (e instanceof DidwwError) throw e;
      throw new DidwwClientError(`Request ${what} failed: ${describeFailure(e)}`, { cause: e });
    }
  }

  // A 2xx JSON body as a document (null when empty); any other status raises DidwwApiError.
  async #readJson(res: http.IncomingMessage, what: string): Promise<unknown> {
    const status = res.statusCode ?? 0;
    if (status < 200 || status > 299) throw await this.#apiError(res);
    if (status === 204) {
      res.resume();
      return null;
    }
    let content: Buffer;
    try {
      content = await decodeBody(await readAll(res, { strict: true }), contentCoding(res));
    } catch (e) {
      if (e instanceof DidwwError) throw new DidwwClientError(`Request ${what} failed: ${e.message}`);
      const cause = e instanceof BodyReadError ? e.cause : e;
      throw new DidwwClientError(`Request ${what} failed: ${describeFailure(cause)}`, { cause });
    }
    if (content.length === 0) return null;
    try {
      return parseJson(content);
    } catch {
      throw new DidwwClientError(`Request ${what} returned a body that is not valid JSON`);
    }
  }

  async #apiError(res: http.IncomingMessage): Promise<DidwwApiError> {
    const status = res.statusCode ?? 0;
    const body = await readErrorBody(res, this.#readTimeout);
    let document: unknown;
    try {
      document = normalizeNumbers(parseJson(body));
    } catch {
      document = body.toString('utf8');
    }
    return new DidwwApiError(status, document);
  }

  // --- File upload / download ---

  /**
   * Uploads one encrypted file (multipart POST) and returns the id of the
   * created encrypted file. The body is built in memory, so it can be sent
   * once more with a new access token when the API refuses the current one.
   *
   * @throws {DidwwApiError} The API refused the upload.
   * @throws {DidwwClientError} The request failed or the answer is unexpected.
   */
  async uploadEncryptedFile(
    fingerprint: string,
    file: { data: Buffer | Uint8Array; description?: string; filename?: string },
  ): Promise<string> {
    if (!(file?.data instanceof Uint8Array)) {
      throw new TypeError('data must be a Buffer or a Uint8Array');
    }
    const formData = new FormData();
    formData.append('encrypted_files[encryption_fingerprint]', fingerprint);
    formData.append('encrypted_files[description]', file.description || '');
    const blob = new Blob([file.data], { type: 'application/octet-stream' });
    formData.append('encrypted_files[file]', blob, file.filename || 'file.enc');
    const encoded = new Response(formData);
    const body = Buffer.from(await encoded.arrayBuffer());
    const contentType = encoded.headers.get('content-type') ?? 'multipart/form-data';

    const what = `POST ${ENCRYPTED_FILE_RESOURCE.path}`;
    const res = await this.#send(
      {
        method: 'POST',
        url: this.#url(ENCRYPTED_FILE_RESOURCE.path),
        headers: { 'Content-Type': contentType, 'Accept-Encoding': 'gzip' },
        body,
      },
      Audience.API,
      what,
    );
    const document = (await this.#readJson(res, what)) as Record<string, unknown> | null;
    const data = document && typeof document === 'object' ? (document.data as Record<string, unknown>) : undefined;
    if (!data || typeof data !== 'object' || typeof data.id !== 'string') {
      throw new DidwwClientError('Unexpected encrypted_files upload response');
    }
    return data.id;
  }

  /**
   * Downloads an export file (.csv.gz) unchanged.
   *
   * The access token is sent only to the origin (scheme, host and port) of the
   * API base URL or of the environment, as the API builds export URLs on the
   * environment's host: a URL on any other origin raises `DidwwClientError`
   * without a request. Redirects are not followed and only a 200 answer is
   * written; any other status raises `DidwwApiError`. The file must arrive
   * whole (its Content-Length is checked).
   *
   * Without `destination` the file is returned as a Buffer. A path is written
   * through a temporary file next to it, which replaces it only once the whole
   * file has arrived. A writable stream receives the data as it arrives and is
   * left open; after a failure it may hold part of the file. Errors of the
   * destination itself, also one it emits during the call, propagate unchanged.
   */
  downloadExport(url: string): Promise<Buffer>;
  downloadExport(url: string, destination: Destination): Promise<void>;
  async downloadExport(url: string, destination?: Destination): Promise<Buffer | void> {
    return this.#downloadExport(url, destination, false);
  }

  /**
   * Downloads a gzip-compressed export (.csv.gz) and returns or writes the
   * decompressed CSV, as `downloadExport` does. Every gzip member is read; a
   * zero byte after a member and everything that follows it are ignored as
   * padding, as by `gzip -d`, while the size of the whole file is still checked
   * against its Content-Length.
   */
  downloadAndDecompressExport(url: string): Promise<Buffer>;
  downloadAndDecompressExport(url: string, destination: Destination): Promise<void>;
  async downloadAndDecompressExport(url: string, destination?: Destination): Promise<Buffer | void> {
    return this.#downloadExport(url, destination, true);
  }

  async #downloadExport(
    url: string,
    destination: Destination | undefined,
    decompress: boolean,
  ): Promise<Buffer | void> {
    if (
      destination !== undefined &&
      typeof destination !== 'string' &&
      typeof (destination as { write?: unknown })?.write !== 'function'
    ) {
      throw new TypeError('destination must be a file path or a writable stream');
    }
    const target = this.#checkExportUrl(url);
    if (typeof destination === 'string') {
      // The temporary file is created first, so a missing directory fails before any request.
      await writeFileAtomically(destination, (write) => this.#fetchExport(target, decompress, write));
      return;
    }
    if (destination === undefined) {
      const chunks: Buffer[] = [];
      await this.#fetchExport(target, decompress, async (chunk) => {
        chunks.push(chunk);
      });
      return Buffer.concat(chunks);
    }
    await writeIntoStream(destination, (write) => this.#fetchExport(target, decompress, write));
  }

  async #fetchExport(target: URL, decompress: boolean, write: (chunk: Buffer) => Promise<void>): Promise<void> {
    const res = await this.#send(
      { method: 'GET', url: target, headers: { 'Accept-Encoding': 'identity' } },
      Audience.API,
      'GET export',
    );
    try {
      if (res.statusCode !== 200) throw await this.#apiError(res);
      await copyExport(res, decompress, write);
    } finally {
      res.destroy();
    }
  }

  #checkExportUrl(url: string): URL {
    const target = originOf(url);
    const base = originOf(this.#baseUrl);
    const environment = originOf(this.#environment);
    if (target !== null && (sameOrigin(target, base) || sameOrigin(target, environment))) {
      return new URL(url);
    }
    const shown =
      target !== null ? formatOrigin(target) : 'that is not an absolute http or https URL without user info';
    throw new DidwwClientError(
      `Export URL ${shown} does not match the API base URL ${formatOrigin(base!)}` +
        ` or the environment URL ${formatOrigin(environment!)}`,
    );
  }

  // --- Prices services ---

  /** The Voice IN price list (`voiceInPricesUrl`). Lookup filters: `number` (required), `src_country_iso`. */
  voiceInPrices(): PricesService<VoiceInPrice, VoiceInPriceFilters> {
    return new PricesService(this.#prices, PRICE_LISTS.voiceIn);
  }

  /** The Voice OUT price list (`voiceOutPricesUrl`). Lookup filters: `number` (required). */
  voiceOutPrices(): PricesService<VoiceOutPrice, VoiceOutPriceFilters> {
    return new PricesService(this.#prices, PRICE_LISTS.voiceOut);
  }

  /** The SMS OUT A2P price list (`smsPricesUrl`). Lookup filters: `dst_number`, `dst_country_iso` or both. */
  smsOutA2pPrices(): PricesService<SmsOutPrice, SmsPriceFilters> {
    return new PricesService(this.#prices, PRICE_LISTS.smsOutA2p);
  }

  /** The SMS OUT P2P price list (`smsPricesUrl`). Lookup filters: `dst_number`, `dst_country_iso` or both. */
  smsOutP2pPrices(): PricesService<SmsOutPrice, SmsPriceFilters> {
    return new PricesService(this.#prices, PRICE_LISTS.smsOutP2p);
  }

  /** The SMS OUT OTP price list (`smsPricesUrl`). Lookup filters: `dst_number`, `dst_country_iso` or both. */
  smsOutOtpPrices(): PricesService<SmsOutPrice, SmsPriceFilters> {
    return new PricesService(this.#prices, PRICE_LISTS.smsOutOtp);
  }

  /** The SMS IN price list (`smsPricesUrl`). Lookup filters: `dst_number`, `dst_country_iso` or both. */
  smsInPrices(): PricesService<SmsInPrice, SmsPriceFilters> {
    return new PricesService(this.#prices, PRICE_LISTS.smsIn);
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
  emergencyRequirementValidations() {
    return createRepository(this, EMERGENCY_REQUIREMENT_VALIDATION_RESOURCE);
  }
  emergencyCallingServices() {
    return createRepository(this, EMERGENCY_CALLING_SERVICE_RESOURCE);
  }
  emergencyVerifications() {
    return createRepository(this, EMERGENCY_VERIFICATION_RESOURCE);
  }
  smsTrunks() {
    return createRepository(this, SMS_TRUNK_RESOURCE);
  }
  smsTrunkGroups() {
    return createRepository(this, SMS_TRUNK_GROUP_RESOURCE);
  }
  smsTrunkRegenerateCredentials() {
    return createRepository(this, SMS_TRUNK_REGENERATE_CREDENTIAL_RESOURCE);
  }
  senderIdVerifications() {
    return createRepository(this, SENDER_ID_VERIFICATION_RESOURCE);
  }
}

function incompleteExport(count: number, expected: number): DidwwClientError {
  return new DidwwClientError(`Export data is incomplete: received ${count} of ${expected} bytes`);
}

function exportReadError(error: BodyReadError): DidwwClientError {
  if (error.incomplete) return new DidwwClientError('Export data is incomplete', { cause: error.cause });
  return new DidwwClientError(`Failed to read export data: ${describeFailure(error.cause)}`, { cause: error.cause });
}

// Copies the body of a 200 export answer to `write`, raw or decompressed.
// Errors of `write` propagate unchanged.
async function copyExport(
  res: http.IncomingMessage,
  decompress: boolean,
  write: (chunk: Buffer) => Promise<void>,
): Promise<void> {
  const expected = contentLength(res);
  const counter = { count: 0 };
  if (decompress) await copyGunzippedExport(res, expected, counter, write);
  else await copyRawExport(res, expected, counter, write);
}

async function copyRawExport(
  res: http.IncomingMessage,
  expected: number | null,
  counter: { count: number },
  write: (chunk: Buffer) => Promise<void>,
): Promise<void> {
  try {
    for await (const chunk of rawChunks(res, counter)) await write(chunk);
  } catch (e) {
    throw e instanceof BodyReadError ? exportReadError(e) : e;
  }
  if (expected !== null && counter.count !== expected) throw incompleteExport(counter.count, expected);
}

async function copyGunzippedExport(
  res: http.IncomingMessage,
  expected: number | null,
  counter: { count: number },
  write: (chunk: Buffer) => Promise<void>,
): Promise<void> {
  const gunzip = zlib.createGunzip();
  const feeding = feedGunzip(rawChunks(res, counter), gunzip);
  feeding.catch(() => undefined);
  const writeErrors = new Set<unknown>();
  try {
    for await (const chunk of gunzip) {
      try {
        await write(chunk as Buffer);
      } catch (e) {
        writeErrors.add(e);
        throw e;
      }
    }
    await feeding;
  } catch (e) {
    if (writeErrors.has(e)) throw e;
    throw decompressError(e, res, expected, counter.count);
  }
  if (expected !== null && counter.count !== expected) throw incompleteExport(counter.count, expected);
  if (counter.count === 0) throw new DidwwClientError('Failed to decompress export data: the export is empty');
}

// The error of a decompressed export whose reading or decompression failed after `count` bytes.
function decompressError(
  error: unknown,
  res: http.IncomingMessage,
  expected: number | null,
  count: number,
): DidwwClientError {
  if (error instanceof BodyReadError) return exportReadError(error);
  if (count === 0) return new DidwwClientError('Failed to decompress export data: the export is empty');
  if (expected !== null && res.complete && count !== expected) return incompleteExport(count, expected);
  return new DidwwClientError('Failed to decompress export data', { cause: error });
}
