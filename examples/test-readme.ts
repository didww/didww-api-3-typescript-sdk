/**
 * Runs the code snippets of the README against the sandbox API: one check per
 * snippet, named after its README section.
 *
 * What the checks create is deleted at the end, and what they change on
 * existing resources (the first DID of the account, a Sender ID verification)
 * is restored, also when a check fails. Orders, exports and the address and
 * emergency verifications cannot be deleted: each verification is printed on a
 * line starting with "REVIEW", for DIDWW to approve or reject it. Only the
 * production client snippets send nothing. Prints "Results: N passed, M failed,
 * K skipped" and exits with 1 when a check fails.
 *
 * Some snippets need more than the SDK; their checks are skipped without it:
 *   - DIDWW_README_PROXY_URL: an HTTP proxy that allows CONNECT, and the
 *     https-proxy-agent package
 *   - DIDWW_README_CA_BUNDLE: a CA bundle file (PEM) that trusts the sandbox hosts
 *   - DIDWW_README_REDIS_URL: a Redis server, and the ioredis package
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/test-readme.ts
 */
import assert from 'node:assert';
import crypto from 'node:crypto';
import { createWriteStream, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  AccessToken,
  AddressVerificationStatus,
  AreaLevel,
  AuthErrorKind,
  CallbackMethod,
  CliFormat,
  Codec,
  DefaultDstAction,
  DiversionRelayPolicy,
  DidwwApiError,
  DidwwAuthError,
  DidwwClient,
  DidwwClientError,
  DidwwError,
  DidwwPricesError,
  EmergencyCallingServiceStatus,
  EmergencyVerificationStatus,
  Encrypt,
  Environment,
  ExportServiceType,
  ExportStatus,
  ExportTrunkType,
  ExportType,
  Feature,
  IceMode,
  IdentityType,
  MediaEncryptionMode,
  MemoryTokenStore,
  NumberType,
  OnCliMismatchAction,
  OrderStatus,
  Pop,
  PriceFileReader,
  PricesErrorKind,
  RequestValidator,
  RxDtmfFormat,
  Scope,
  SenderIdVerificationStatus,
  SenderType,
  SmsBodyType,
  SmsHttpMethod,
  SmsServerLocation,
  SmsTrunkConfigurationType,
  SstRefreshMethod,
  StirShakenMode,
  TransportProtocol,
  TxDtmfFormat,
  VoiceOutCodec,
  VoiceOutPriceCategory,
  VoiceOutTrunkStatus,
  availableDidOrderItem,
  calculateFingerprint,
  capacityOrderItem,
  credentialsAndIpAuthenticationMethod,
  didOrderItem,
  encryptWithKeys,
  genericSmsTrunkConfiguration,
  isExportCompleted,
  isIncluded,
  isSmsHttpIn,
  isSmsHttpOut,
  isSmsSmppEsme,
  pstnConfiguration,
  ref,
  reservationDidOrderItem,
  sipConfiguration,
  smsHttpInConfiguration,
  smsHttpOutConfiguration,
} from '../src/index.js';
import type {
  AvailableDid,
  CapacityPool,
  Country,
  CredentialsAndIpAuthenticationMethod,
  Did,
  DidGroup,
  DidWrite,
  DidwwLogger,
  IdentityWrite,
  ProofType,
  QtyBasedPricing,
  ResourceRef,
  SipConfiguration,
  SmsTrunk,
  StockKeepingUnit,
  TokenStore,
  VoiceInTrunk,
  VoiceInTrunkGroup,
} from '../src/index.js';

const API_KEY = process.env.DIDWW_API_KEY!;
const client = new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX });
const suffix = crypto.randomBytes(4).toString('hex');
const here = dirname(fileURLToPath(import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), 'didww-readme-'));

// ─── Runner ────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

/** Thrown by a check whose snippet cannot run here; the check is reported as skipped. */
class Skip extends Error {}

function skip(reason: string): never {
  throw new Skip(reason);
}

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    if (err instanceof Skip) {
      skipped++;
      console.log(`  - ${name}: skipped, ${err.message}`);
      return;
    }
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

/** A value set by an earlier check; fails the current check when that check failed. */
function needs<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`needs ${what}`);
  return value;
}

// Changes to existing resources are undone first, then what was created is
// deleted, newest first, and the uploaded files last, once the proofs that use
// them are gone with their identity. A resource deleted already (404) counts as deleted.
type Cleanup = { name: string; run: () => Promise<void> };
const restores: Cleanup[] = [];
const deletions: Cleanup[] = [];
const fileDeletions: Cleanup[] = [];

/**
 * A resource that a verification may still use (mayBeInUse) is kept when the API
 * refuses to delete it, and the output says so.
 */
function deleteLater(name: string, run: () => Promise<void>, list: Cleanup[] = deletions, mayBeInUse = false) {
  list.push({
    name,
    run: async () => {
      try {
        await run();
      } catch (err) {
        if (err instanceof DidwwApiError && err.status === 404) return;
        if (mayBeInUse && err instanceof DidwwApiError && err.status >= 400 && err.status < 500) {
          const reason = err.errors.map((e) => e.detail ?? e.title).join('; ') || err.message;
          console.log(`  kept ${name}: the API refuses to delete it (${reason})`);
          return;
        }
        throw err;
      }
    },
  });
}

/** Imports a package that only a README snippet needs; undefined when it is not installed. */
async function importOptional(name: string): Promise<Record<string, unknown> | undefined> {
  try {
    return (await import(name)) as Record<string, unknown>;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') return undefined;
    throw err;
  }
}

/** The message of an API error with the detail of each error, for a failed check. */
function apiErrorDetails(error: unknown): unknown {
  if (!(error instanceof DidwwApiError)) return error;
  return new Error(`${error.message}: ${error.errors.map((e) => e.detail ?? e.title).join('; ')}`);
}

/** Runs fn once; later calls get the same promise. */
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= fn());
}

// ─── Shared fixtures ───────────────────────────────────────

const usCountry = once(async () => {
  const countries = await client.countries().list({ filter: { iso: 'US' } });
  return needs(countries.data[0], 'country US');
});

const uaCountry = once(async () => {
  const countries = await client.countries().list({ filter: { iso: 'UA' } });
  return needs(countries.data[0], 'country UA');
});

/** DIDs and addresses the verification checks use, so that one check does not take those of the other. */
const usedDidIds = new Set<string>();
const createdAddressIds = new Set<string>();

/** Orders an available DID (included with did_group.stock_keeping_units) and waits for the order to complete. */
async function orderAvailableDid(ad: AvailableDid): Promise<Did> {
  const skuId = needs(
    isIncluded<DidGroup>(ad.didGroup) ? ad.didGroup.stockKeepingUnits?.[0]?.id : undefined,
    `a SKU of available DID ${ad.number}`,
  );
  let { data: order } = await client.orders().create({
    items: [availableDidOrderItem({ skuId, availableDidId: ad.id })],
  });
  for (let attempt = 0; attempt < 12 && order.status === OrderStatus.PENDING; attempt++) {
    await sleep(5_000);
    order = (await client.orders().find(order.id)).data;
  }
  assert(order.status === OrderStatus.COMPLETED, `order ${order.id} of ${ad.number} is ${order.status}`);
  const dids = await client.dids().list({ filter: { 'order.id': order.id } });
  const did = needs(dids.data[0], `the DID of order ${order.id}`);
  console.log(`    ordered DID ${did.number} (order ${order.reference})`);
  return did;
}

/** Uploads examples/sample.pdf encrypted and returns the encrypted file id; it is deleted at the end when unused. */
async function uploadSamplePdf(description: string): Promise<string> {
  const enc = new Encrypt(client);
  const id = await client.uploadEncryptedFile(await enc.getFingerprint(), {
    data: await enc.encrypt(readFileSync(resolve(here, 'sample.pdf'))),
    description,
    filename: `${description}.pdf.enc`,
  });
  deleteLater(`encrypted file ${id}`, () => client.encryptedFiles().remove(id), fileDeletions, true);
  return id;
}

const firstSkuId = once(async () => {
  const groups = await client.didGroups().list({ include: 'stock_keeping_units', page: { size: 10 } });
  for (const group of groups.data) {
    const sku = (group.stockKeepingUnits ?? []).find((s): s is StockKeepingUnit => isIncluded(s));
    if (sku) return sku.id;
  }
  throw new Error('no DID group with stock keeping units');
});

const DID_INCLUDE = 'voice_in_trunk,voice_in_trunk_group,sms_trunk,sms_trunk_group,capacity_pool';

/** The first DID of the account; its routing, description and capacity limit are restored at the end. */
const firstDid = once(async (): Promise<Did> => {
  const dids = await client.dids().list({ include: DID_INCLUDE, page: { number: 1, size: 1 } });
  const did = dids.data[0];
  if (!did) skip('no DID on the account');
  const restore: DidWrite & { id: string } = {
    id: did.id,
    description: did.description,
    capacityLimit: did.capacityLimit,
  };
  if (did.voiceInTrunk) restore.voiceInTrunk = ref('voice_in_trunks', did.voiceInTrunk.id);
  else if (did.voiceInTrunkGroup) restore.voiceInTrunkGroup = ref('voice_in_trunk_groups', did.voiceInTrunkGroup.id);
  else {
    restore.voiceInTrunk = null;
    restore.voiceInTrunkGroup = null;
  }
  if (did.smsTrunk) restore.smsTrunk = ref('sms_trunks', did.smsTrunk.id);
  else if (did.smsTrunkGroup) restore.smsTrunkGroup = ref('sms_trunk_groups', did.smsTrunkGroup.id);
  else {
    restore.smsTrunk = null;
    restore.smsTrunkGroup = null;
  }
  restores.push({
    name: `DID ${did.number}`,
    run: async () => {
      await client.dids().update(restore);
    },
  });
  return did;
});

const tempTrunk = once(async () => {
  const trunk = await client.voiceInTrunks().create({
    name: `README PSTN ${suffix}`,
    configuration: pstnConfiguration({ dst: '12125551234' }),
  });
  deleteLater(`trunk ${trunk.data.id}`, () => client.voiceInTrunks().remove(trunk.data.id));
  return trunk.data;
});

const tempTrunkGroup = once(async () => {
  const group = await client.voiceInTrunkGroups().create({ name: `README Group ${suffix}`, capacityLimit: 5 });
  deleteLater(`trunk group ${group.data.id}`, () => client.voiceInTrunkGroups().remove(group.data.id));
  return group.data;
});

async function createHttpInSmsTrunk(name: string): Promise<SmsTrunk> {
  const trunk = await client.smsTrunks().create({
    name: `${name} ${suffix}`,
    configuration: smsHttpInConfiguration({
      url: 'https://example.com/sms',
      httpMethod: SmsHttpMethod.POST,
      bodyType: SmsBodyType.JSON,
      body: '{"text":"{SMS_TEXT}","from":"{SMS_SRC_ADDR}","to":"{SMS_DST_ADDR}"}',
    }),
  });
  deleteLater(`SMS trunk ${trunk.data.id}`, () => client.smsTrunks().remove(trunk.data.id));
  return trunk.data;
}

const httpInSmsTrunk = once(() => createHttpInSmsTrunk('README HTTP IN'));

const httpOutSmsTrunk = once(async () => {
  const trunk = await client.smsTrunks().create({
    name: `README HTTP OUT ${suffix}`,
    configuration: smsHttpOutConfiguration({
      callbackUrl: 'https://example.com/sms/status',
      allowedIps: ['203.0.113.10'],
    }),
  });
  deleteLater(`SMS trunk ${trunk.data.id}`, () => client.smsTrunks().remove(trunk.data.id));
  return trunk.data;
});

const smsTrunkGroup = once(async () => {
  const member = await createHttpInSmsTrunk('README group member');
  const group = await client.smsTrunkGroups().create({
    name: `README SMS Group ${suffix}`,
    smsTrunks: [ref('sms_trunks', member.id)],
  });
  deleteLater(`SMS trunk group ${group.data.id}`, () => client.smsTrunkGroups().remove(group.data.id));
  return group.data;
});

/** Treats a missing price plan, or a price file not generated yet, as a skip. */
async function withPricePlan<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DidwwPricesError && error.kind === PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED) {
      skip(`no price plan on the account (${error.message})`);
    }
    if (error instanceof DidwwPricesError && error.kind === PricesErrorKind.SERVICE_UNAVAILABLE) {
      skip(`the price file is not available yet (${error.message})`);
    }
    throw error;
  }
}

// HMAC-SHA1 over the URL with its port written out, then every payload key and
// value in key order: how DIDWW signs a callback (see examples/webhook.ts)
function signLikeDidww(secret: string, url: string, payload: Record<string, string>): string {
  const parsed = new URL(url);
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  let data = `${parsed.protocol}//${parsed.hostname}:${port}${parsed.pathname}${parsed.search}`;
  // UTF-16 code unit order, as RequestValidator sorts the keys; localeCompare would order mixed case differently
  const keys = Object.keys(payload).sort((a, b) => Number(a > b) - Number(a < b));
  for (const key of keys) data += key + payload[key];
  return crypto.createHmac('sha1', secret).update(data).digest('hex');
}

// ─── Quick Start ───────────────────────────────────────────

section('Quick Start');

await check('Quick Start: balance and countries', async () => {
  const balance = await client.balance().find();
  assert(typeof balance.data.totalBalance === 'string', 'totalBalance should be a string');
  console.log(`    balance: ${balance.data.totalBalance}`);
  const countries = await client.countries().list();
  assert(countries.data.length > 0, 'should have countries');
  for (const country of countries.data.slice(0, 3)) {
    console.log(`    ${country.iso} - ${country.name}`);
  }
});

// ─── Configuration ─────────────────────────────────────────

section('Configuration');

await check('Configuration: production and sandbox clients', async () => {
  // Built only: no request is sent to production
  const production = new DidwwClient({ apiKey: 'your-api-key', environment: Environment.PRODUCTION });
  assert(production.scope === null, 'the production client should request no scope');
  const sandbox = new DidwwClient({
    apiKey: API_KEY,
    environment: Environment.SANDBOX,
    scope: Scope.READ,
    logger: console,
    connectTimeout: 5_000,
  });
  // countries are not paginated: the API returns all of them
  const countries = await sandbox.countries().list();
  assert(countries.data.length > 0, 'the sandbox client should read countries');
  assert(!JSON.stringify(sandbox).includes(API_KEY), 'the API key should not be serialized');
});

/** The part of https-proxy-agent the proxy check uses. */
type ProxyAgent = https.Agent & { connect(req: unknown, opts: unknown): Promise<unknown> };

await check('Proxy, TLS and connections: through an HTTP proxy', async () => {
  const proxyUrl = process.env.DIDWW_README_PROXY_URL || skip('set DIDWW_README_PROXY_URL to an HTTP proxy');
  const proxyAgentModule = (await importOptional('https-proxy-agent')) ?? skip('install https-proxy-agent');
  const HttpsProxyAgent = (proxyAgentModule.HttpsProxyAgent ??
    (proxyAgentModule.default as Record<string, unknown> | undefined)?.HttpsProxyAgent) as new (
    proxy: string,
  ) => ProxyAgent;
  // The README's proxy.example.com is the proxy of the environment; the client talks to the sandbox
  const agent = new HttpsProxyAgent(proxyUrl);
  let tunnels = 0;
  const connect = agent.connect.bind(agent);
  agent.connect = (req, opts) => {
    tunnels++;
    return connect(req, opts);
  };
  try {
    // A token store of its own, so that the token request goes through the proxy too
    const proxied = new DidwwClient({
      apiKey: API_KEY,
      environment: Environment.SANDBOX,
      agent,
      tokenStore: new MemoryTokenStore(),
    });
    const balance = await proxied.balance().find();
    assert(typeof balance.data.totalBalance === 'string', 'totalBalance should be a string');
    assert(tunnels > 0, 'the requests should go through the proxy');
    console.log(`    ${tunnels} connections through the proxy`);
  } finally {
    agent.destroy();
  }
});

await check('Proxy, TLS and connections: own CA bundle and keep-alive', async () => {
  const caBundle = process.env.DIDWW_README_CA_BUNDLE || skip('set DIDWW_README_CA_BUNDLE to a CA bundle file');
  const agent = new https.Agent({ keepAlive: true, ca: readFileSync(caBundle) });
  try {
    const keepAlive = new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX, agent });
    await keepAlive.balance().find();
    await keepAlive.countries().list({ page: { size: 1 } });
  } finally {
    agent.destroy();
  }
});

await check('Scope: read-only client', async () => {
  const readOnly = new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX, scope: Scope.READ });
  assert(readOnly.scope === Scope.READ, 'scope should be read');
  const countries = await readOnly.countries().list();
  assert(countries.data.length > 0, 'should read countries');
});

await check('Token cache: TokenStore interface', async () => {
  const entries = new Map<string, AccessToken>();
  let sets = 0;
  const store: TokenStore = {
    get: (key) => entries.get(key),
    set: (key, token) => {
      sets++;
      entries.set(key, token);
    },
    delete: (key) => {
      entries.delete(key);
    },
  };
  await new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX, tokenStore: store }).balance().find();
  await new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX, tokenStore: store }).balance().find();
  assert(sets === 1, `one token should be minted and then reused, got ${sets} sets`);
});

/** The part of an ioredis client the Redis snippet uses. */
interface Redis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...expiry: (string | number)[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  quit(): Promise<unknown>;
}

await check('Token cache: Redis token store', async () => {
  const redisUrl = process.env.DIDWW_README_REDIS_URL || skip('set DIDWW_README_REDIS_URL to a Redis server');
  const ioredis = (await importOptional('ioredis')) ?? skip('install ioredis');
  const RedisClient = (ioredis.Redis ?? ioredis.default) as new (url: string, options: object) => Redis;

  // The README's store, counting what it stores and what it reads back
  class RedisTokenStore implements TokenStore {
    readonly keys: string[] = [];
    sets = 0;
    hits = 0;
    constructor(private readonly redis: Redis) {}

    async get(key: string): Promise<AccessToken | null> {
      const raw = await this.redis.get(key);
      if (raw !== null) this.hits++;
      return raw === null ? null : AccessToken.fromData(JSON.parse(raw));
    }

    async set(key: string, token: AccessToken, ttlSeconds: number): Promise<void> {
      this.sets++;
      this.keys.push(key);
      const value = JSON.stringify(token.toData());
      if (ttlSeconds > 0) await this.redis.set(key, value, 'EX', Math.ceil(ttlSeconds));
      else await this.redis.set(key, value);
    }

    async delete(key: string): Promise<void> {
      await this.redis.del(key);
    }
  }

  // Two connections, as two processes would have; the key prefix keeps this run's token apart
  const options = { connectTimeout: 5_000, commandTimeout: 5_000, keyPrefix: `didww-readme-${suffix}:` };
  const first = new RedisClient(redisUrl, options);
  const second = new RedisClient(redisUrl, options);
  const firstStore = new RedisTokenStore(first);
  try {
    await new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX, tokenStore: firstStore })
      .balance()
      .find();
    assert(firstStore.sets === 1, `the first client should mint and store one token, stored ${firstStore.sets}`);

    const secondStore = new RedisTokenStore(second);
    await new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX, tokenStore: secondStore })
      .balance()
      .find();
    assert(secondStore.hits > 0, 'the second client should read the token from Redis');
    assert(secondStore.sets === 0, 'the second client should reuse the token, not mint one');
  } finally {
    if (firstStore.keys.length > 0) await first.del(...firstStore.keys);
    await Promise.allSettled([first.quit(), second.quit()]);
  }
});

await check('Logging: console and a (details, message) logger adapter', async () => {
  const records: string[] = [];
  const pinoLogger = {
    warn: (_obj: object, msg: string) => {
      records.push(`warn ${msg}`);
    },
    debug: (_obj: object, msg: string) => {
      records.push(`debug ${msg}`);
    },
  };
  const adapter: DidwwLogger = {
    warn: (message, details) => pinoLogger.warn(details ?? {}, message),
    debug: (message, details) => pinoLogger.debug(details ?? {}, message),
  };
  const withConsole = new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX, logger: console });
  assert(withConsole.scope === null, 'should build a client with console as logger');
  // A store of its own, so a token is minted and logged
  const logged = new DidwwClient({
    apiKey: API_KEY,
    environment: Environment.SANDBOX,
    logger: adapter,
    tokenStore: new MemoryTokenStore(),
  });
  await logged.balance().find();
  assert(records.length > 0, 'the adapter should receive messages');
  console.log(`    adapter received ${records.length} messages, e.g. "${records[0]}"`);
});

// ─── Resources ─────────────────────────────────────────────

section('Read-Only Resources');

await check('Read-Only Resources: countries, regions, DID groups, available DIDs, pools, balance', async () => {
  const countries = await client.countries().list();
  const country = await client.countries().find(countries.data[0].id);
  assert(country.data.id === countries.data[0].id, 'find should return the country');
  await client.regions().list({ page: { size: 3 } });
  await client.cities().list({ page: { size: 3 } });
  await client.areas().list({ page: { size: 3 } });

  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    filter: { number_type: NumberType.TOLL_FREE },
    page: { size: 3 },
  });
  for (const group of groups.data) {
    assert(group.numberType === NumberType.TOLL_FREE, 'should be a toll-free DID group');
    console.log(`    ${group.prefix} ${group.stockKeepingUnits?.length ?? 0} SKUs`);
  }

  const available = await client.availableDids().list({ include: 'did_group.stock_keeping_units', page: { size: 3 } });
  const ad = available.data[0];
  if (ad) {
    const skus = isIncluded<DidGroup>(ad.didGroup) ? ad.didGroup.stockKeepingUnits : undefined;
    console.log(`    available ${ad.number}, ${skus?.length ?? 0} SKUs`);
  }

  await client.nanpaPrefixes().list({ page: { size: 1 } });
  const proofTypes = await client.proofTypes().list();
  assert(proofTypes.data.length > 0, 'should have proof types');
  const keys = await client.publicKeys().list();
  assert(keys.data.length > 0, 'should have public keys');
  await client.addressRequirements().list({ page: { size: 1 } });
  await client.supportingDocumentTemplates().list({ page: { size: 1 } });

  const pools = await client.capacityPools().list({ include: 'qty_based_pricings' });
  const pricings = (pools.data[0]?.qtyBasedPricings ?? []).filter((p): p is QtyBasedPricing => isIncluded(p));
  console.log(`    ${pools.data.length} capacity pools, ${pricings.length} qty-based pricings in the first`);

  const balance = await client.balance().find();
  assert(typeof balance.data.totalBalance === 'string', 'totalBalance should be a string');
});

await check('Read-Only Resources: DID group number type and demo flag', async () => {
  const groups = await client.didGroups().list({ page: { size: 1 } });
  const { data: group } = await client.didGroups().find(groups.data[0].id);
  assert(
    (Object.values(NumberType) as string[]).includes(group.numberType),
    `unexpected number type ${group.numberType}`,
  );
  assert(typeof group.isDemo === 'boolean', 'isDemo should be a boolean');
  console.log(`    ${group.prefix} numberType=${group.numberType} isDemo=${group.isDemo}`);
});

section('DIDs');

await check('DIDs: assign a trunk, update attributes, unassign the trunk', async () => {
  const dids = await client.dids().list({ page: { size: 3 } });
  assert(Array.isArray(dids.data), 'should list DIDs');
  const did = await firstDid();
  const trunk = await tempTrunk();

  await client.dids().update({ id: did.id, voiceInTrunk: ref('voice_in_trunks', trunk.id) });
  let state = await client.dids().find(did.id, { include: 'voice_in_trunk,voice_in_trunk_group' });
  assert(state.data.voiceInTrunk?.id === trunk.id, 'the trunk should be assigned');
  assert(!state.data.voiceInTrunkGroup, 'the trunk group should be cleared');

  // The DID keeps its capacity pool and dedicated channels: the same values are sent
  const update: DidWrite & { id: string } = { id: did.id, capacityLimit: 5, description: 'Updated' };
  if (did.capacityPool) {
    update.capacityPool = ref('capacity_pools', did.capacityPool.id);
    update.dedicatedChannelsCount = did.dedicatedChannelsCount;
  }
  const updated = await client.dids().update(update);
  assert(updated.data.capacityLimit === 5 && updated.data.description === 'Updated', 'attributes should be updated');

  await client.dids().update({ id: did.id, voiceInTrunk: null });
  state = await client.dids().find(did.id, { include: 'voice_in_trunk' });
  assert(!state.data.voiceInTrunk, 'the trunk should be unassigned');
});

await check('DIDs: SMS routing', async () => {
  const did = await firstDid();
  const trunk = await httpInSmsTrunk();
  const group = await smsTrunkGroup();
  const include = 'sms_trunk,sms_trunk_group';

  await client.dids().update({ id: did.id, smsTrunk: ref('sms_trunks', trunk.id) });
  let state = await client.dids().find(did.id, { include });
  assert(state.data.smsTrunk?.id === trunk.id && !state.data.smsTrunkGroup, 'the SMS trunk should be assigned');

  const routed = await client.dids().list({ filter: { 'sms_trunk.id': trunk.id }, include });
  assert(
    routed.data.some((d) => d.id === did.id),
    'the DID should be listed by its SMS trunk',
  );

  await client.dids().update({ id: did.id, smsTrunkGroup: ref('sms_trunk_groups', group.id) });
  state = await client.dids().find(did.id, { include });
  assert(state.data.smsTrunkGroup?.id === group.id && !state.data.smsTrunk, 'the SMS trunk group should be assigned');

  await client.dids().update({ id: did.id, smsTrunk: null, smsTrunkGroup: null });
  state = await client.dids().find(did.id, { include });
  assert(!state.data.smsTrunk && !state.data.smsTrunkGroup, 'the DID should be unrouted');
});

section('Voice In Trunks');

await check('Voice In Trunks: create SIP and PSTN trunks, update, delete', async () => {
  const trunk = await client.voiceInTrunks().create({
    name: `README SIP ${suffix}`,
    configuration: sipConfiguration({
      host: 'sip.example.com',
      port: 5060,
      codecs: [Codec.PCMA, Codec.PCMU, Codec.TELEPHONE_EVENT],
      iceMode: IceMode.ACCEPT,
      transportProtocolId: TransportProtocol.UDP,
    }),
    pop: Pop.FRA,
  });
  deleteLater(`trunk ${trunk.data.id}`, () => client.voiceInTrunks().remove(trunk.data.id));
  assert(trunk.data.configuration.type === 'sip_configurations', 'should be a SIP trunk');
  assert(trunk.data.pop === Pop.FRA, 'pop should be fra');

  const pstnTrunk = await client.voiceInTrunks().create({
    name: `README PSTN trunk ${suffix}`,
    configuration: pstnConfiguration({ dst: '12125551234' }),
  });
  deleteLater(`trunk ${pstnTrunk.data.id}`, () => client.voiceInTrunks().remove(pstnTrunk.data.id));
  assert(pstnTrunk.data.configuration.type === 'pstn_configurations', 'should be a PSTN trunk');

  const updated = await client.voiceInTrunks().update({ id: trunk.data.id, name: `README Updated ${suffix}` });
  assert(updated.data.name === `README Updated ${suffix}`, 'name should be updated');

  await client.voiceInTrunks().remove(trunk.data.id);
});

await check('Voice In Trunks: point of presence', async () => {
  const trunk = await tempTrunk();
  const updated = await client.voiceInTrunks().update({ id: trunk.id, pop: Pop.AMS });
  assert(updated.data.pop === Pop.AMS, 'pop should be ams');
});

let sipRegistrationTrunkId: string | undefined;

await check('SIP Registration: create a registered trunk', async () => {
  const trunk = await client.voiceInTrunks().create({
    name: `README registered ${suffix}`,
    configuration: sipConfiguration({
      enabledSipRegistration: true,
      useDidInRuri: true,
      cnamLookup: true,
      codecs: [Codec.PCMU, Codec.PCMA],
    }),
  });
  sipRegistrationTrunkId = trunk.data.id;
  deleteLater(`trunk ${trunk.data.id}`, () => client.voiceInTrunks().remove(trunk.data.id));
  const config = trunk.data.configuration as SipConfiguration;
  assert(config.enabledSipRegistration === true, 'SIP registration should be enabled');
  assert(config.incomingAuthUsername && config.incomingAuthPassword, 'credentials should be generated');
});

await check('SIP Registration: disable by setting the host', async () => {
  const id = needs(sipRegistrationTrunkId, 'the trunk of the previous check');
  const updated = await client.voiceInTrunks().update({
    id,
    configuration: sipConfiguration({ host: 'sip.example.com' }),
  });
  const config = updated.data.configuration as SipConfiguration;
  assert(config.enabledSipRegistration === false && config.host === 'sip.example.com', 'registration should be off');
});

section('Voice In Trunk Groups');

await check('Voice In Trunk Groups: create', async () => {
  const group = await client.voiceInTrunkGroups().create({ name: `README Primary ${suffix}`, capacityLimit: 50 });
  deleteLater(`trunk group ${group.data.id}`, () => client.voiceInTrunkGroups().remove(group.data.id));
  assert(group.data.capacityLimit === 50, 'capacity limit should be 50');
});

section('Voice Out Trunks');

await check('Voice Out Trunks: create with credentials and IP', async () => {
  const voTrunk = await client.voiceOutTrunks().create({
    name: `README Outbound ${suffix}`,
    // username and password are server-generated, so they are left out
    authenticationMethod: credentialsAndIpAuthenticationMethod({
      allowedSipIps: ['203.0.113.0/24'],
      techPrefix: '',
    } as Omit<CredentialsAndIpAuthenticationMethod, 'type'>),
    defaultDstAction: DefaultDstAction.ALLOW_ALL,
    onCliMismatchAction: OnCliMismatchAction.REJECT_CALL,
    codecs: [VoiceOutCodec.OPUS, VoiceOutCodec.PCMA, VoiceOutCodec.TELEPHONE_EVENT],
  });
  deleteLater(`Voice OUT trunk ${voTrunk.data.id}`, () => client.voiceOutTrunks().remove(voTrunk.data.id));
  assert.deepStrictEqual(voTrunk.data.codecs, ['opus', 'pcma', 'telephone_event'], 'codecs should match');
});

section('SMS Trunks');

await check('SMS Trunks: create, update, clear attributes, list by configuration type', async () => {
  const created = await createHttpInSmsTrunk('README Inbound webhook');
  await client.smsTrunks().update({
    id: created.id,
    configuration: smsHttpInConfiguration({ url: 'https://example.com/sms/v2' }),
  });
  const cleared = await client.smsTrunks().update({
    id: created.id,
    configuration: smsHttpInConfiguration({ httpMethod: SmsHttpMethod.GET, bodyType: null, body: null }),
  });
  const config = cleared.data.configuration;
  assert(isSmsHttpIn(config), 'should stay an HTTP IN trunk');
  assert(config.url === 'https://example.com/sms/v2', 'the URL should be kept');
  assert(config.httpMethod === SmsHttpMethod.GET && config.body == null, 'method should be GET without a body');

  const trunks = await client.smsTrunks().list({
    filter: { 'configuration.type': ['http_in', 'sms_to_email'] },
    include: 'sms_trunk_group',
  });
  assert(
    trunks.data.some((t) => t.id === created.id),
    'the new trunk should be listed',
  );
});

await check('SMS Trunks: edit a loaded configuration', async () => {
  const { id } = await httpInSmsTrunk();
  const { data: trunk } = await client.smsTrunks().find(id);
  assert(isSmsHttpIn(trunk.configuration), 'should be an HTTP IN trunk');
  trunk.configuration.url = 'https://example.com/sms/v3';
  const updated = await client.smsTrunks().update(trunk);
  const config = updated.data.configuration;
  assert(isSmsHttpIn(config) && config.url === 'https://example.com/sms/v3', 'the URL should be updated');
});

await check('SMS Trunks: generic configuration', async () => {
  const { id } = await httpInSmsTrunk();
  const updated = await client.smsTrunks().update({
    id,
    // The trunk of the previous checks sends a JSON body; a GET trunk must have none
    configuration: genericSmsTrunkConfiguration('http_in', {
      url: 'https://example.com/sms',
      http_method: 'get',
      body_type: null,
      body: null,
    }),
  });
  const config = updated.data.configuration;
  assert(isSmsHttpIn(config) && config.httpMethod === SmsHttpMethod.GET, 'method should be GET');
});

await check('SMS Trunks: regenerate credentials', async () => {
  const { id } = await httpOutSmsTrunk();
  await client.smsTrunkRegenerateCredentials().create({ smsTrunk: ref('sms_trunks', id) });
  const { data: outTrunk } = await client.smsTrunks().find(id);
  const configuration = outTrunk.configuration;
  if (isSmsHttpOut(configuration)) {
    assert(configuration.authName && configuration.authPassword, 'the new credentials should be readable');
  } else if (isSmsSmppEsme(configuration)) {
    assert(configuration.systemId && configuration.password, 'the new credentials should be readable');
  } else {
    assert.fail(`unexpected configuration ${configuration.type}`);
  }
});

section('SMS Trunk Groups');

let smsGroupId: string | undefined;

await check('SMS Trunk Groups: create', async () => {
  const trunk = await createHttpInSmsTrunk('README group');
  const created = await client.smsTrunkGroups().create({
    name: `README Inbound SMS ${suffix}`,
    smsTrunks: [ref('sms_trunks', trunk.id)],
  });
  smsGroupId = created.data.id;
  deleteLater(`SMS trunk group ${created.data.id}`, () => client.smsTrunkGroups().remove(created.data.id));
  assert(created.data.meta?.smsTrunksCount === 1, `should have 1 trunk, got ${created.data.meta?.smsTrunksCount}`);
});

await check('SMS Trunk Groups: add a trunk, then empty the group', async () => {
  const groupId = needs(smsGroupId, 'the group of the previous check');
  const another = await createHttpInSmsTrunk('README another');
  const { data: current } = await client.smsTrunkGroups().find(groupId, { include: 'sms_trunks' });
  const members = (current.smsTrunks ?? []).map((trunk) => ref('sms_trunks', trunk.id));
  members.push(ref('sms_trunks', another.id));
  const grown = await client.smsTrunkGroups().update({ id: current.id, smsTrunks: members });
  assert(grown.data.meta?.smsTrunksCount === 2, `should have 2 trunks, got ${grown.data.meta?.smsTrunksCount}`);
  const emptied = await client.smsTrunkGroups().update({ id: groupId, smsTrunks: [] });
  assert(!emptied.data.meta?.smsTrunksCount, 'the group should be empty');
});

section('Sender ID Verifications');

await check('Sender ID Verifications: assign and unassign the SMS trunk', async () => {
  const { data: verifications } = await client.senderIdVerifications().list({
    filter: { status: SenderIdVerificationStatus.ACTIVE },
    include: 'sms_trunk',
  });
  const verification = verifications[0];
  if (!verification) skip('no active Sender ID verification on the account');
  // The original trunk is assigned again right away: without a trunk outbound messages stop
  const originalTrunkId = verification.smsTrunk?.id;
  const trunkId = originalTrunkId ?? (await httpOutSmsTrunk()).id;
  try {
    await client.senderIdVerifications().update({ id: verification.id, smsTrunk: ref('sms_trunks', trunkId) });
    const cleared = await client.senderIdVerifications().update({ id: verification.id, smsTrunk: null });
    assert(!cleared.data.smsTrunk, 'the SMS trunk should be unassigned');
  } finally {
    await client.senderIdVerifications().update({
      id: verification.id,
      smsTrunk: originalTrunkId ? ref('sms_trunks', originalTrunkId) : null,
    });
  }
});

section('Orders');

await check('Orders: by SKU, available DID, reserved DID and capacity', async () => {
  const skuId = await firstSkuId();
  const order = await client.orders().create({
    allowBackOrdering: true,
    items: [didOrderItem({ skuId, qty: 1 })],
  });
  console.log(`    by SKU: ${order.data.id} ${order.data.status}`);

  const available = await client.availableDids().list({ include: 'did_group.stock_keeping_units', page: { size: 2 } });
  if (available.data.length < 2) skip('fewer than 2 available DIDs');
  const skuOf = (index: number) => {
    const group = available.data[index].didGroup;
    return needs(isIncluded<DidGroup>(group) ? group.stockKeepingUnits?.[0]?.id : undefined, 'an available DID SKU');
  };
  const order2 = await client.orders().create({
    items: [availableDidOrderItem({ skuId: skuOf(0), availableDidId: available.data[0].id })],
  });
  console.log(`    available DID: ${order2.data.id} ${order2.data.status}`);

  const reservedSkuId = skuOf(1);
  const reservation = await client.didReservations().create({
    description: 'README order',
    availableDid: ref('available_dids', available.data[1].id),
  });
  // Deleted at the end only when the order fails; an accepted order uses the reservation
  let reservationOrdered = false;
  deleteLater(`reservation ${reservation.data.id}`, async () => {
    if (!reservationOrdered) await client.didReservations().remove(reservation.data.id);
  });
  const order3 = await client.orders().create({
    items: [reservationDidOrderItem({ skuId: reservedSkuId, didReservationId: reservation.data.id })],
  });
  reservationOrdered = true;
  console.log(`    reserved DID: ${order3.data.id} ${order3.data.status}`);

  const pools = await client.capacityPools().list({ page: { size: 1 } });
  const pool = needs(pools.data[0], 'a capacity pool');
  const order4 = await client.orders().create({ items: [capacityOrderItem({ capacityPoolId: pool.id, qty: 1 })] });
  console.log(`    capacity: ${order4.data.id} ${order4.data.status}`);
  assert(
    [order, order2, order3, order4].every((o) => Object.values(OrderStatus).includes(o.data.status as OrderStatus)),
    'every order should have a known status',
  );
});

await check('DID Reservations: create and delete', async () => {
  const available = await client.availableDids().list({ page: { size: 1 } });
  const availableDid = needs(available.data[0], 'an available DID');
  const reservation = await client.didReservations().create({
    description: 'Reserved for client',
    availableDid: ref('available_dids', availableDid.id),
  });
  deleteLater(`reservation ${reservation.data.id}`, () => client.didReservations().remove(reservation.data.id));
  await client.didReservations().remove(reservation.data.id);
});

await check('Shared Capacity Groups: create', async () => {
  const pools = await client.capacityPools().list({ page: { size: 1 } });
  const pool = needs(pools.data[0], 'a capacity pool');
  const scg = await client.sharedCapacityGroups().create({
    name: `README Shared Group ${suffix}`,
    sharedChannelsCount: 1,
    meteredChannelsCount: 5,
    capacityPool: ref('capacity_pools', pool.id),
  });
  deleteLater(`shared capacity group ${scg.data.id}`, () => client.sharedCapacityGroups().remove(scg.data.id));
  assert(scg.data.meteredChannelsCount === 5, 'metered channels should be 5');
});

section('Identities and Addresses');

let identityId: string | undefined;

await check('Identities: create', async () => {
  const country = await usCountry();
  const identity = await client.identities().create({
    identityType: IdentityType.PERSONAL,
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '12125551234',
    country: ref('countries', country.id),
  });
  identityId = identity.data.id;
  deleteLater(`identity ${identity.data.id}`, () => client.identities().remove(identity.data.id));
});

await check('Identities: update the company website', async () => {
  // companyWebsite belongs to business identities; a personal identity refuses it
  const country = await usCountry();
  const business = await client.identities().create({
    identityType: IdentityType.BUSINESS,
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '12125551234',
    companyName: 'Example Inc',
    companyRegNumber: '12345678',
    vatId: 'US123456789',
    country: ref('countries', country.id),
  });
  const id = business.data.id;
  deleteLater(`identity ${id}`, () => client.identities().remove(id));
  const updated = await client.identities().update({ id, companyWebsite: 'https://www.example.com' });
  assert(updated.data.companyWebsite === 'https://www.example.com', 'website should be set');
});

await check('Addresses: create', async () => {
  const id = needs(identityId, 'the identity of the Identities check');
  const country = await usCountry();
  const address = await client.addresses().create({
    cityName: 'New York',
    postalCode: '10001',
    address: '123 Main St',
    identity: ref('identities', id),
    country: ref('countries', country.id),
  });
  createdAddressIds.add(address.data.id);
  deleteLater(`address ${address.data.id}`, () => client.addresses().remove(address.data.id));
});

section('Exports');

await check('Exports: CDR and SMS-Out exports, download of a completed export', async () => {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const format = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');
  const from = format(new Date(midnight.getTime() - 86_400_000));
  const to = format(midnight);

  const exp = await client.exports().create({ exportType: ExportType.CDR_IN, filters: { from, to } });
  assert(exp.data.exportType === ExportType.CDR_IN, 'should be a cdr_in export');
  const outTrunk = await httpOutSmsTrunk();
  const smsOut = await client.exports().create({
    exportType: ExportType.SMS_OUT,
    filters: { from, to, serviceType: ExportServiceType.A2P, 'smsTrunk.id': [outTrunk.id] },
  });
  const { data: found } = await client.exports().find(smsOut.data.id);
  console.log(`    SMS-Out export ${found.id}: ${found.status}`);

  // A new export is pending: the download runs on the newest completed one, if any
  const listed = await client.exports().list({ page: { size: 50 } });
  const completed = listed.data
    .filter((e) => isExportCompleted(e) && e.url)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!completed?.url) {
    console.log('    no completed export on the account: download not run');
    return;
  }
  let gzipped: Buffer;
  try {
    gzipped = await client.downloadExport(completed.url);
  } catch (error) {
    if (!(error instanceof DidwwApiError && error.status === 404)) throw error;
    console.log(`    the file of export ${completed.id} is no longer available: download not run`);
    return;
  }
  assert(gzipped.length > 0, 'the export should not be empty');
  await client.downloadExport(completed.url, join(workDir, 'export.csv.gz'));
  await client.downloadAndDecompressExport(completed.url, join(workDir, 'export.csv'));
  const out = createWriteStream(join(workDir, 'copy.csv.gz'));
  await client.downloadExport(completed.url, out);
  out.end();
  await finished(out);
  assert(readFileSync(join(workDir, 'copy.csv.gz')).equals(gzipped), 'the streamed copy should match');
  console.log(`    downloaded export ${completed.id} (${gzipped.length} bytes gzipped)`);
});

section('Address Verifications');

await check('Address Verifications: list', async () => {
  const verifications = await client.addressVerifications().list();
  console.log(`    ${verifications.data.length} address verifications`);
});
/** The description of the address this check creates; the emergency check leaves such addresses alone. */
const README_ADDRESS = 'README address verification check';

/** The identity fields an address requirement can make mandatory, as the API spells them. */
const MANDATORY_IDENTITY_FIELDS: Record<string, (countryId: string) => IdentityWrite> = {
  birth_date: () => ({ birthDate: '1980-01-01' }),
  country: (countryId) => ({ country: ref('countries', countryId) }),
  birth_country: (countryId) => ({ birthCountry: ref('countries', countryId) }),
  id_number: () => ({ idNumber: 'AB123456' }),
  personal_tax_id: () => ({ personalTaxId: '1234567890' }),
  contact_email: () => ({ contactEmail: 'john.doe@example.com' }),
  tax_id: () => ({ vatId: 'UA12345678' }),
  company_reg_number: () => ({ companyRegNumber: '12345678' }),
};

/** Creates `qty` proofs for the entity, each with its own upload of sample.pdf. */
async function createProofs(entity: ResourceRef, qty: number, proofTypes: (ProofType | ResourceRef)[] | undefined) {
  for (let i = 0; i < qty; i++) {
    const proofType = needs(proofTypes?.[i % proofTypes.length], `a proof type for ${entity.type}`);
    const fileId = await uploadSamplePdf(`${entity.type}-proof-${i + 1}`);
    await client.proofs().create({
      proofType: ref('proof_types', proofType.id),
      entity,
      files: [ref('encrypted_files', fileId)],
    });
  }
}

/** A DID of the account whose DID group needs an address and that has no address verification; ordered when none. */
async function didNeedingAddress(countryId: string): Promise<Did> {
  const owned = await client.dids().list({
    filter: { 'country.id': countryId, terminated: 'false' },
    include: 'did_group.address_requirement,address_verification',
    page: { size: 50 },
  });
  const reusable = owned.data.find(
    (d) =>
      !d.addressVerification &&
      !usedDidIds.has(d.id) &&
      isIncluded<DidGroup>(d.didGroup) &&
      Boolean(d.didGroup.addressRequirement),
  );
  if (reusable) return reusable;
  const available = await client.availableDids().list({
    filter: { 'country.id': countryId, 'did_group.number_type': NumberType.LOCAL },
    include: 'did_group.stock_keeping_units,did_group.address_requirement',
    page: { size: 50 },
  });
  const ad = needs(
    available.data.find((a) => isIncluded<DidGroup>(a.didGroup) && a.didGroup.addressRequirement),
    'an available DID whose DID group needs an address',
  );
  return orderAvailableDid(ad);
}

await check('Address Verifications: create', async () => {
  // Ukrainian Local DID groups need an address
  const ukraine = await uaCountry();
  const chosen = await didNeedingAddress(ukraine.id);
  usedDidIds.add(chosen.id);
  const { data: did } = await client.dids().find(chosen.id, { include: 'did_group' });
  const group = did.didGroup;
  assert(isIncluded<DidGroup>(group), 'the DID group should be included');
  const groupWithRequirement = await client.didGroups().find(group.id, { include: 'address_requirement' });
  const requirementId = needs(groupWithRequirement.data.addressRequirement?.id, 'the address requirement');
  const { data: requirement } = await client.addressRequirements().find(requirementId, {
    include:
      'personal_proof_types,business_proof_types,address_proof_types,personal_permanent_document,business_permanent_document',
  });
  const business = requirement.identityType === IdentityType.BUSINESS || requirement.personalAreaLevel === null;
  console.log(`    DID ${did.number} (${group.areaName}), requirement ${requirement.id}, ${requirement.identityType}`);

  // An identity and an address that meet the requirement
  const mandatory = business ? requirement.businessMandatoryFields : requirement.personalMandatoryFields;
  const identityAttributes: IdentityWrite = {
    identityType: business ? IdentityType.BUSINESS : IdentityType.PERSONAL,
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '380487000000',
    country: ref('countries', ukraine.id),
    ...(business ? { companyName: 'Example LLC' } : {}),
  };
  for (const field of mandatory) Object.assign(identityAttributes, MANDATORY_IDENTITY_FIELDS[field]?.(ukraine.id));
  const identity = await client.identities().create(identityAttributes);
  deleteLater(`identity ${identity.data.id}`, () => client.identities().remove(identity.data.id), deletions, true);

  const city = group.city ? (await client.cities().find(group.city.id, { include: 'area' })).data : undefined;
  const address = await client.addresses().create({
    cityName: city?.name ?? 'Odesa',
    postalCode: '65000',
    address: '1 Derybasivska St',
    description: README_ADDRESS,
    identity: ref('identities', identity.data.id),
    country: ref('countries', ukraine.id),
    ...(city ? { city: ref('cities', city.id) } : {}),
    ...(city?.area ? { area: ref('areas', city.area.id) } : {}),
  });
  createdAddressIds.add(address.data.id);
  deleteLater(`address ${address.data.id}`, () => client.addresses().remove(address.data.id), deletions, true);

  // The proofs and the permanent document the requirement lists
  const identityRef = ref('identities', identity.data.id);
  await createProofs(
    identityRef,
    business ? requirement.businessProofQty : requirement.personalProofQty,
    business ? requirement.businessProofTypes : requirement.personalProofTypes,
  );
  await createProofs(ref('addresses', address.data.id), requirement.addressProofQty, requirement.addressProofTypes);
  const template = business ? requirement.businessPermanentDocument : requirement.personalPermanentDocument;
  if (template) {
    const fileId = await uploadSamplePdf('permanent-document');
    await client.permanentSupportingDocuments().create({
      identity: identityRef,
      template: ref('supporting_document_templates', template.id),
      files: [ref('encrypted_files', fileId)],
    });
  }
  const onetime = business ? requirement.businessOnetimeDocument : requirement.personalOnetimeDocument;
  if (onetime) console.log(`    the requirement also lists one-time document ${onetime.id}, not sent with the request`);

  try {
    await client.addressRequirementValidations().create({
      addressRequirement: ref('address_requirements', requirement.id),
      identity: identityRef,
      address: ref('addresses', address.data.id),
    });
  } catch (error) {
    throw apiErrorDetails(error);
  }

  // The README snippet
  const verification = await client.addressVerifications().create({
    callbackUrl: 'https://example.com/callback',
    callbackMethod: CallbackMethod.POST,
    address: ref('addresses', address.data.id),
    dids: [ref('dids', did.id)],
    ...(requirement.serviceDescriptionRequired ? { serviceDescription: 'Inbound calls of a small office' } : {}),
  });
  console.log(`REVIEW address_verification ${verification.data.id} ${verification.data.reference}`);
});

section('Emergency Services');

await check('Emergency Services: list requirements and calling services', async () => {
  const emergReqs = await client.emergencyRequirements().list({ page: { size: 3 } });
  const emergServices = await client.emergencyCallingServices().list({ page: { size: 3 } });
  console.log(`    ${emergReqs.data.length} requirements, ${emergServices.data.length} calling services`);
});
await check('Emergency Services: create an emergency verification', async () => {
  // An address of the account with its identity, as examples/emergency-scenario.ts uses it, preferably
  // in Ukraine; not one that this script created, now or in an earlier run
  const ukraine = await uaCountry();
  const addresses = await client.addresses().list({ include: 'country,identity' });
  const candidates = addresses.data.filter(
    (a) => a.country && a.identity && !createdAddressIds.has(a.id) && a.description !== README_ADDRESS,
  );
  const address = needs(
    candidates.find((a) => a.country?.id === ukraine.id) ?? candidates[0],
    'an address with a country and an identity on the account',
  );
  const countryId = address.country!.id;
  const identityId = address.identity!.id;

  // A DID with emergency calling in the country of the address, without an emergency calling service
  const owned = await client.dids().list({
    filter: {
      'country.id': countryId,
      'did_group.features': 'emergency',
      emergency_enabled: 'false',
      terminated: 'false',
    },
    include: 'emergency_calling_service',
    page: { size: 50 },
  });
  let did = owned.data.find((d) => !d.emergencyCallingService && !usedDidIds.has(d.id));
  if (!did) {
    const available = await client.availableDids().list({
      filter: { 'country.id': countryId, 'did_group.features': 'emergency' },
      include: 'did_group.stock_keeping_units',
      page: { size: 1 },
    });
    did = await orderAvailableDid(needs(available.data[0], 'an available DID with emergency calling'));
  }
  usedDidIds.add(did.id);
  const { data: withGroup } = await client.dids().find(did.id, { include: 'did_group' });
  const group = withGroup.didGroup;
  assert(isIncluded<DidGroup>(group), 'the DID group should be included');

  const requirements = await client.emergencyRequirements().list({
    filter: { 'country.id': countryId, number_type: group.numberType },
  });
  const requirement = needs(requirements.data[0], `an emergency requirement for ${group.numberType} numbers`);
  try {
    await client.emergencyRequirementValidations().create({
      emergencyRequirement: ref('emergency_requirements', requirement.id),
      address: ref('addresses', address.id),
      identity: ref('identities', identityId),
    });
  } catch (error) {
    throw apiErrorDetails(error);
  }
  console.log(`    DID ${withGroup.number}, address ${address.id}, requirement ${requirement.id}`);

  // The README snippet
  const emergVerification = await client.emergencyVerifications().create({
    callbackUrl: 'https://example.com/callback',
    callbackMethod: CallbackMethod.POST,
    address: ref('addresses', address.id),
    dids: [ref('dids', did.id)],
  });
  console.log(`REVIEW emergency_verification ${emergVerification.data.id} ${emergVerification.data.reference}`);
});

section('DID History');

await check('DID History: list', async () => {
  const history = await client.didHistory().list({ page: { size: 5 } });
  for (const entry of history.data) {
    console.log(`    ${entry.action} ${entry.createdAt}`);
  }
});

// ─── Prices ────────────────────────────────────────────────

section('Prices');

await check('Price lookups: Voice IN, Voice OUT, SMS OUT A2P, SMS IN', async () => {
  const result = await withPricePlan(() =>
    client.voiceInPrices().lookup({ number: '18005550123', src_country_iso: 'US' }),
  );
  for (const price of result.rows) {
    if (price.rate !== null) console.log(`    ${price.destination} ${price.sourceType}: ${price.rate} USD/min`);
  }
  const voiceOut = await withPricePlan(() => client.voiceOutPrices().lookup({ number: '493012345678' }));
  if (voiceOut.rows[0]?.category === VoiceOutPriceCategory.INTERNATIONAL) {
    console.log(`    Voice OUT rate ${voiceOut.rows[0].rate}`);
  }
  const a2p = await withPricePlan(() => client.smsOutA2pPrices().lookup({ dst_number: '4915123456789' }));
  const smsIn = await withPricePlan(() => client.smsInPrices().lookup({ dst_country_iso: 'US' }));
  console.log(`    ${result.totalRecords} Voice IN, ${a2p.totalRecords} A2P, ${smsIn.totalRecords} SMS IN rows`);
});

await check('Price files: fetch, read, head, download', async () => {
  const prices = client.voiceInPrices();
  const path = join(workDir, 'voice_in_prices.csv.gz');
  const file = await withPricePlan(() => prices.fetch(path));
  console.log(`    downloaded ${file.bytesWritten} bytes, last modified ${file.lastModified?.toISOString()}`);
  // 304 while the file is unchanged; 200 when it changed in between or carries no Last-Modified
  const again = await prices.fetch(path);
  console.log(`    fetched again: ${again.notModified ? 'not modified, file kept' : `${again.bytesWritten} bytes`}`);

  let count = 0;
  for await (const row of new PriceFileReader(path)) {
    assert(typeof row === 'object', 'a row should be an object');
    if (++count === 5) break;
  }
  assert(count > 0, 'the price file should have rows');

  const status = await prices.head({ ifModifiedSince: file.lastModified });
  console.log(`    HEAD: notModified=${status.notModified} filename=${status.filename}`);
  await prices.downloadToFile(path);
  const out = createWriteStream(join(workDir, 'copy_of_voice_in_prices.csv.gz'));
  await prices.download(out, { ifModifiedSince: new Date('2026-10-01T00:00:00Z') });
  out.end();
  await finished(out);
});

// ─── Included Resources, Query Parameters ──────────────────

section('Included Resources');

await check('Included Resources: regions, DID groups, available DIDs, DIDs', async () => {
  const regions = await client.regions().list({ include: 'country', page: { size: 3 } });
  for (const region of regions.data) {
    assert(isIncluded<Country>(region.country), 'the country should be included');
  }
  const groups = await client.didGroups().list({ include: 'stock_keeping_units', page: { size: 3 } });
  for (const group of groups.data) {
    for (const sku of group.stockKeepingUnits || []) {
      assert(isIncluded<StockKeepingUnit>(sku), 'the SKU should be included');
    }
  }
  const available = await client.availableDids().list({ include: 'did_group.stock_keeping_units', page: { size: 1 } });
  const ad = available.data[0];
  if (ad) {
    const skuId = isIncluded<DidGroup>(ad.didGroup) ? ad.didGroup.stockKeepingUnits?.[0]?.id : undefined;
    console.log(`    available ${ad.number} sku=${skuId}`);
  }
  const dids = await client.dids().list({ include: 'voice_in_trunk,capacity_pool', page: { size: 3 } });
  for (const did of dids.data) {
    const trunk = isIncluded<VoiceInTrunk>(did.voiceInTrunk) ? did.voiceInTrunk.name : null;
    const pool = isIncluded<CapacityPool>(did.capacityPool) ? did.capacityPool.name : null;
    console.log(`    ${did.number} trunk=${trunk} pool=${pool}`);
  }
});

section('Query Parameters');

await check('Query Parameters: filter, include, sort, page', async () => {
  const country = await usCountry();
  const result = await client.regions().list({
    filter: { 'country.id': country.id, name: 'Arizona' },
    include: ['country'],
    sort: '-name',
    page: { number: 1, size: 25 },
  });
  assert(
    result.data.some((r) => r.name === 'Arizona'),
    'Arizona should be found',
  );
});

// ─── Dirty Tracking ────────────────────────────────────────

section('Dirty Tracking');

await check('Dirty Tracking: update a loaded DID', async () => {
  const { id } = await firstDid();
  const response = await client.dids().find(id, { include: 'voice_in_trunk' });
  const did = response.data;
  did.description = 'Updated description';
  const updated = await client.dids().update(did);
  assert(updated.data.description === 'Updated description', 'description should be updated');
});

await check('Dirty Tracking: update from a plain object', async () => {
  const { id } = await firstDid();
  const updated = await client.dids().update({ id, description: 'Updated', capacityLimit: 5 });
  assert(updated.data.description === 'Updated' && updated.data.capacityLimit === 5, 'attributes should be updated');
});

await check('Dirty Tracking: update an included trunk group', async () => {
  const { id } = await firstDid();
  const trunkGroup = await tempTrunkGroup();
  await client.dids().update({ id, voiceInTrunkGroup: ref('voice_in_trunk_groups', trunkGroup.id) });
  const response = await client.dids().find(id, { include: 'voice_in_trunk_group' });
  const group = response.data.voiceInTrunkGroup;
  assert(isIncluded<VoiceInTrunkGroup>(group), 'the trunk group should be included');
  group.name = `README Renamed group ${suffix}`;
  const updated = await client.voiceInTrunkGroups().update(group);
  assert(updated.data.name === `README Renamed group ${suffix}`, 'the group should be renamed');
});

await check('Dirty Tracking: clear a relationship', async () => {
  const { id } = await firstDid();
  const trunk = await tempTrunk();
  await client.dids().update({ id, voiceInTrunk: ref('voice_in_trunks', trunk.id) });
  const response = await client.dids().find(id, { include: 'voice_in_trunk' });
  const did = response.data;
  did.voiceInTrunk = null;
  await client.dids().update(did);
  const after = await client.dids().find(id, { include: 'voice_in_trunk' });
  assert(!after.data.voiceInTrunk, 'the trunk should be cleared');
});

// ─── Dates, Enums ──────────────────────────────────────────

section('Date and Datetime Fields');

await check('Date and Datetime Fields: ISO strings', async () => {
  const { id } = await firstDid();
  const did = await client.dids().find(id);
  // The README parses with date-fns; Date.parse reads the same ISO 8601 strings
  assert(!Number.isNaN(Date.parse(did.data.createdAt)), `createdAt should be ISO 8601: ${did.data.createdAt}`);
  assert(did.data.expiresAt === null || !Number.isNaN(Date.parse(did.data.expiresAt)), 'expiresAt: null or ISO');
  console.log(`    createdAt=${did.data.createdAt} expiresAt=${did.data.expiresAt}`);
});

section('Enums');

await check('Enums: every listed enum is exported', async () => {
  const enums = {
    CallbackMethod,
    AddressVerificationStatus,
    ExportType,
    ExportStatus,
    ExportTrunkType,
    ExportServiceType,
    IdentityType,
    OrderStatus,
    OnCliMismatchAction,
    MediaEncryptionMode,
    DefaultDstAction,
    VoiceOutTrunkStatus,
    CliFormat,
    AreaLevel,
    Feature,
    StirShakenMode,
    EmergencyCallingServiceStatus,
    EmergencyVerificationStatus,
    DiversionRelayPolicy,
    NumberType,
    Pop,
    Codec,
    VoiceOutCodec,
    IceMode,
    SmsTrunkConfigurationType,
    SmsHttpMethod,
    SmsBodyType,
    SmsServerLocation,
    SenderIdVerificationStatus,
    SenderType,
    VoiceOutPriceCategory,
    TransportProtocol,
    RxDtmfFormat,
    TxDtmfFormat,
    SstRefreshMethod,
    Scope,
    AuthErrorKind,
    PricesErrorKind,
  };
  for (const [name, value] of Object.entries(enums)) {
    assert(value && Object.keys(value).length > 0, `${name} should be exported`);
  }
  assert(Pop.FRA === 'fra' && TransportProtocol.UDP === 1, 'wire values should match the README');
});

// ─── File Encryption & Upload ──────────────────────────────

section('File Encryption & Upload');

const fileBuffer = readFileSync(resolve(here, 'sample.pdf'));

await check('File Encryption: Encrypt instance and upload', async () => {
  const enc = new Encrypt(client);
  const fingerprint = await enc.getFingerprint();
  const encrypted = await enc.encrypt(fileBuffer);
  const id = await client.uploadEncryptedFile(fingerprint, {
    data: encrypted,
    description: 'My document',
    filename: 'document.pdf.enc',
  });
  deleteLater(`encrypted file ${id}`, () => client.encryptedFiles().remove(id), fileDeletions);
  console.log(`    uploaded encrypted file ${id}`);
});

await check('File Encryption: static functions, upload and proof', async () => {
  const entityId = needs(identityId, 'the identity of the Identities check');
  const keys = await client.publicKeys().list();
  const pems: [string, string] = [keys.data[0].key, keys.data[1].key];
  const fingerprint = calculateFingerprint(pems);
  writeFileSync(join(workDir, 'document.pdf'), fileBuffer);
  const encrypted = encryptWithKeys(readFileSync(join(workDir, 'document.pdf')), pems);
  const id = await client.uploadEncryptedFile(fingerprint, {
    data: encrypted,
    description: 'My document',
    filename: 'document.pdf.enc',
  });
  deleteLater(`encrypted file ${id}`, () => client.encryptedFiles().remove(id), fileDeletions);

  const proofTypes = await client.proofTypes().list();
  const proofType = needs(
    proofTypes.data.find((pt) => pt.entityType === IdentityType.PERSONAL),
    'a proof type for personal identities',
  );
  const proof = await client.proofs().create({
    proofType: ref('proof_types', proofType.id),
    entity: ref('identities', entityId),
    files: [ref('encrypted_files', id)],
  });
  console.log(`    created proof ${proof.data.id} (${proofType.name})`);
});

// ─── Webhook Signature Validation ──────────────────────────

section('Webhook Signature Validation');

await check('Webhook Signature Validation: valid and tampered callbacks', async () => {
  const validator = new RequestValidator('your-callback-secret');
  const requestUrl = 'https://example.com/didww/callbacks';
  const payload = { id: 'order-id', type: 'orders', status: 'completed' };
  const signature = signLikeDidww('your-callback-secret', requestUrl, payload);
  assert(validator.validate(requestUrl, payload, signature), 'the signed callback should be valid');
  assert(!validator.validate(requestUrl, { ...payload, status: 'canceled' }, signature), 'tampered should fail');
});

// ─── Error Handling ────────────────────────────────────────

section('Error Handling');

await check('Error Handling: DidwwApiError', async () => {
  try {
    await client.voiceInTrunks().find('nonexistent');
    assert.fail('should have thrown');
  } catch (error) {
    if (error instanceof DidwwApiError) {
      console.log(`    status ${error.status}: ${error.errors.map((e) => e.detail ?? e.title).join('; ')}`);
    } else if (error instanceof DidwwClientError) {
      throw new Error(`expected DidwwApiError, got DidwwClientError: ${error.message}`);
    } else {
      throw error;
    }
  }
});

await check('Error Handling: API rate limit', async () => {
  try {
    await client.dids().list({ page: { size: 1 } });
  } catch (error) {
    if (error instanceof DidwwApiError && error.status === 429) {
      console.log(`    API rate limit, retry after ${error.retryAfter} s`);
    } else {
      throw error;
    }
  }
});

await check('Error Handling: token service and prices errors', async () => {
  try {
    await client.smsOutA2pPrices().lookup({ dst_number: '4915123456789' });
  } catch (error) {
    if (error instanceof DidwwAuthError) {
      if (error.kind === AuthErrorKind.RATE_LIMITED) {
        console.log(`    token service rate limit, retry after ${error.retryAfter} s`);
      } else {
        throw error;
      }
    } else if (error instanceof DidwwPricesError) {
      if (error.kind === PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED) skip(`no price plan (${error.message})`);
      if (error.kind === PricesErrorKind.PRICE_NOT_FOUND) {
        console.log('    no price for this number');
      } else {
        throw error;
      }
    } else if (error instanceof DidwwError) {
      throw new Error(`unexpected DidwwError: ${error.message}`);
    } else {
      throw error;
    }
  }
});

// ─── Cleanup and summary ───────────────────────────────────

section('Cleanup');

const newestFirst = [...deletions].reverse();
for (const cleanup of [...restores, ...newestFirst, ...fileDeletions]) {
  try {
    await cleanup.run();
    console.log(`  cleaned up ${cleanup.name}`);
  } catch (err: unknown) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`cleanup of ${cleanup.name}: ${msg}`);
    console.log(`  ✗ cleanup of ${cleanup.name}: ${msg}`);
  }
}
rmSync(workDir, { recursive: true, force: true });

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
}
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
