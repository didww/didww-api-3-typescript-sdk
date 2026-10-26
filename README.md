# @didww/sdk

TypeScript SDK for the DIDWW API v3.

![Tests](https://github.com/didww/didww-api-3-typescript-sdk/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/endpoint?url=https://didww.github.io/didww-api-3-typescript-sdk/badge.json)
![Node](https://img.shields.io/badge/node-18%2B-blue)

## About DIDWW API v3

The DIDWW API provides a simple yet powerful interface that allows you to fully integrate your own applications with DIDWW services. An extensive set of actions may be performed using this API, such as ordering and configuring phone numbers, setting capacity, creating SIP trunks and retrieving CDRs and other operational data.

The DIDWW API v3 is a fully compliant implementation of the [JSON API specification](http://jsonapi.org/format/).

This SDK uses [kitsu-core](https://github.com/wopian/kitsu/tree/master/packages/kitsu-core) to serialize JSON:API request bodies and to convert key case; responses are read by the SDK itself.

Read more https://doc.didww.com/api

## API Version

This SDK targets DIDWW API version `2026-10-22` (exported as `DEFAULT_API_VERSION`). The version is not sent as a header: it is requested in the `api_version` of every access token the SDK mints (see [Authentication](#authentication)).

| NPM Version | Branch | DIDWW API Version |
|-------------|--------|-------------------|
| **4.x** | [`main`](https://github.com/didww/didww-api-3-typescript-sdk) | [`2026-10-22`](https://doc.didww.com/api3/2026-10-22/index.html) |
| **3.x** | [`release-3`](https://github.com/didww/didww-api-3-typescript-sdk/tree/release-3) | [`2026-04-16`](https://doc.didww.com/api3/2026-04-16/index.html) |
| **2.x** | [`2022-05-10`](https://github.com/didww/didww-api-3-typescript-sdk/tree/2022-05-10) | [`2022-05-10`](https://doc.didww.com/api3/2022-05-10/index.html) |

`new DidwwClient({ ..., apiVersion: 'YYYY-MM-DD' })` requests a later version. The constructor throws a `DidwwClientError` for a value that is not a `YYYY-MM-DD` date and for a version earlier than `2026-10-22`. The resources of earlier API versions are not in this release: use 3.x from the [`release-3`](https://github.com/didww/didww-api-3-typescript-sdk/tree/release-3) branch for API `2026-04-16` (see [Migrating from 3.x](#migrating-from-3x)).

## Requirements

- Node.js 18+

The SDK depends only on [kitsu-core](https://github.com/wopian/kitsu/tree/master/packages/kitsu-core). It sends its requests with `node:http` and `node:https` and adds no logging dependency: it logs only to a logger you pass (see [Logging](#logging)). The package ships both an ES module and a CommonJS build.

## Installation

```bash
npm install @didww/sdk
```

For API `2026-04-16`, stay on 3.x:

```bash
npm install @didww/sdk@^3
```

## Quick Start

```typescript
import { DidwwClient, Environment } from '@didww/sdk';

const client = new DidwwClient({
  apiKey: 'your-api-key',
  environment: Environment.SANDBOX, // or Environment.PRODUCTION
});

// Check balance
const balance = await client.balance().find();
console.log(balance.data.totalBalance);

// List countries
const countries = await client.countries().list();
for (const country of countries.data) {
  console.log(`${country.iso} - ${country.name}`);
}
```

One client may serve any number of concurrent calls: build one per API key and environment and reuse it. Every call returns a promise.

For more examples visit [examples](examples/).

For details on obtaining your API key please visit https://doc.didww.com/api3/configuration.html

## Examples

- Source code: [examples/](examples/)
- How to run: [examples/README.md](examples/README.md)

## Configuration

```typescript
import { DidwwClient, Environment, Scope } from '@didww/sdk';

// Production
const client = new DidwwClient({
  apiKey: 'your-api-key',
  environment: Environment.PRODUCTION,
});

// Sandbox, read-only tokens, a logger, a shorter connect timeout
const sandbox = new DidwwClient({
  apiKey: 'your-api-key',
  environment: Environment.SANDBOX,
  scope: Scope.READ,
  logger: console,
  connectTimeout: 5_000, // milliseconds
});
```

All timeouts are in milliseconds.

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | required | Your API key. |
| `environment` | `Environment.SANDBOX` | `Environment.PRODUCTION` or `Environment.SANDBOX`. It selects the API, token service and price hosts. See [Environments](#environments). |
| `baseUrl` | API URL of the environment | JSON:API base URL only, including `/v3`. |
| `apiVersion` | `DEFAULT_API_VERSION` (`'2026-10-22'`) | API version requested in every token. See [API Version](#api-version). |
| `scope` | none | `Scope.READ` or `Scope.FULL` (`'read'`, `'full'`). Without it no scope is requested and the token service grants `full`. See [Scope](#scope). |
| `tokenStore` | one `MemoryTokenStore` shared by every client of the process built without its own | Cache for access tokens. See [Token cache](#token-cache). |
| `logger` | none (silent) | Receives the token warnings and debug events. See [Logging](#logging). |
| `connectTimeout` | `10_000` | Allowed to open a connection: the TCP connection, the tunnel of a proxy agent and the TLS handshake, and with an `agent` that caps `maxSockets` the wait for a free socket. `null` for no limit. |
| `readTimeout` | `60_000` | Allowed for each read: the wait for the response headers and between two parts of a body. `null` for no limit. |
| `timeout` | none | Allowed for a whole HTTP exchange, body included. **It also cuts off a large price or export file that is still arriving**, so leave it unset unless you need a hard limit. |
| `agent` | Node.js's global agents | An `http.Agent` used for every request, for a proxy, TLS settings or keep-alive. See [Proxy, TLS and connections](#proxy-tls-and-connections). |
| `authUrl` | Token service of the environment | Token service base URL. |
| `voiceInPricesUrl`, `voiceOutPricesUrl`, `smsPricesUrl` | Price hosts of the environment | Price service base URLs, with or without the `/v3` suffix. |

The API key is sent only to the token service. An overridden URL, for example to send the traffic through a gateway of yours, does not change the token audiences (see [Authentication](#authentication)). The values in use can be read back as `client.environment`, `client.baseUrl`, `client.apiVersion`, `client.scope`, `client.authUrl`, `client.voiceInPricesUrl`, `client.voiceOutPricesUrl`, `client.smsPricesUrl` and `client.tokenStore`.

The constructor throws a `DidwwClientError` (see [Error Handling](#error-handling)), before any request, for:

- a missing or empty API key, or one with a character outside printable ASCII or a space (a control character, such as a trailing newline or a tab, or a non-ASCII character, such as a non-breaking space);
- an `environment` that is not an `Environment` member;
- an API version that is not a `YYYY-MM-DD` date, or that is earlier than `2026-10-22`;
- a `scope` other than `Scope.READ`, `Scope.FULL`, `null` or `undefined`;
- a timeout that is not a positive number of milliseconds up to 2,147,483,647, or `null`;
- a `tokenStore` without `get`, `set` and `delete` methods, a `logger` without any of the `debug`, `info`, `warn` and `error` methods, or an `agent` that is not an `http.Agent`;
- a base, token service or prices URL that is not an http or https URL with a host, contains a space, a control character or a backslash, has a query or fragment, or has user info (`user:password@`);
- the `fetch` option of 3.x, which was removed (see [Migrating from 3.x](#migrating-from-3x)).

`console.log(client)`, `util.inspect(client)` and `JSON.stringify(client)` show the environment, the base and token service URLs, the API version and the scope, never the API key.

### Environments

| Environment | API | Token service | Voice IN prices | Voice OUT prices | SMS prices |
|-------------|-----|---------------|-----------------|------------------|------------|
| `Environment.PRODUCTION` | `https://api.didww.com/v3` | `https://auth.didww.com` | `https://api-vin.didww.com/v3` | `https://api-vout.didww.com/v3` | `https://api-sms.didww.com/v3` |
| `Environment.SANDBOX` | `https://sandbox-api.didww.com/v3` | `https://auth-sandbox.didww.com` | `https://api-vin-sandbox.didww.com/v3` | `https://api-vout-sandbox.didww.com/v3` | `https://api-sms-sandbox.didww.com/v3` |

`ENVIRONMENT_ENDPOINTS[environment]` holds the token service and price URLs of each environment. A firewall that limits outgoing traffic must allow the token service, and the price hosts when you use [Prices](#prices).

### Proxy, TLS and connections

The SDK sends every request itself with `node:http` and `node:https`: the token service, the JSON:API, encrypted file upload, export download and prices. Pass an `http.Agent` as `agent` to route them through a proxy, to trust your own CA or to reuse connections. All default URLs are https, so pass an `https.Agent` or a proxy agent.

> **Note:** [https-proxy-agent](https://github.com/TooTallNate/proxy-agents/tree/main/packages/https-proxy-agent) must be installed separately: `npm install https-proxy-agent`

```typescript
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { DidwwClient, Environment } from '@didww/sdk';

// Through an HTTP proxy
const proxied = new DidwwClient({
  apiKey: 'your-api-key',
  environment: Environment.PRODUCTION,
  agent: new HttpsProxyAgent('http://proxy.example.com:8080'),
});

// Your own CA bundle, and connections kept open between calls
const agent = new https.Agent({ keepAlive: true, ca: readFileSync('/etc/ssl/certs/my-ca-bundle.pem') });
const client = new DidwwClient({ apiKey: 'your-api-key', environment: Environment.PRODUCTION, agent });
```

Without `agent` the SDK uses Node.js's global agents (`https.globalAgent`), so whatever configures them for the process applies. They keep connections alive from Node.js 19 on; **on Node.js 18 every request opens a new connection** unless you pass an agent with `keepAlive: true`. An agent you pass is yours: destroy it when you are done with the client.

`connectTimeout` starts with the request, so the time a proxy agent takes to open its tunnel counts as connecting, and so does the time a request waits for a free socket of an agent with `maxSockets`; a call queued that way still settles when its connect or total timeout runs out. `readTimeout` applies to each read, not to the whole call, so a large price or export file is not cut off while its data keeps arriving; it is paused while your destination stream is busy with a chunk. A pending call keeps the process alive until it settles.

On every call the SDK:

- follows no redirects, so that neither a token nor the API key is sent to another URL; a 3xx answer is an error (see [Error Handling](#error-handling));
- stores and sends no cookies, so no state is carried between calls or API keys;
- sets the `Authorization: Bearer` header itself, and sends `User-Agent: didww-typescript-sdk/<version>`.

Price files, price lookups and export files are requested with `Accept-Encoding: identity`, and the files are written exactly as served (gzipped). JSON:API and upload calls send `Accept-Encoding: gzip`, and the SDK decodes a gzip or deflate answer. Each attempt of a token request must be answered in full within 10 s, independently of your timeouts. An error answer is read up to 1 MiB, within the read timeout (60 s when `readTimeout` is `null`).

Instrumentation that records request headers, such as an APM agent or a debugging proxy, sees the `Api-Key` header of the token requests and the `Authorization` header of the others: configure it to scrub them.

## Authentication

Every request carries `Authorization: Bearer <token>`. The SDK mints the tokens itself with `POST /token` on the token service, sending your API key in the `Api-Key` header. The API key is sent nowhere else. No code change is needed for this: `new DidwwClient({ apiKey, environment })` works as before.

- **Audience.** One token per audience, minted on the first call to a service and reused until it expires. The audience is the production hostname of the service, in the sandbox too:

  | Calls | Token audience |
  |-------|----------------|
  | JSON:API resources, export download, encrypted file upload | `api.didww.com` |
  | Voice IN prices | `api-vin.didww.com` |
  | Voice OUT prices | `api-vout.didww.com` |
  | SMS OUT (A2P, P2P, OTP) and SMS IN prices | `api-sms.didww.com` |

  `client.publicKeys()` is sent without a token and without any `Authorization` header.
- **Expiry and 401.** A cached token lives for the `expires_in` granted; the SDK adds no local expiry margin. When a request is answered 401, the SDK drops that token, mints a new one and sends the request once more (an upload body is kept in memory for this). A second 401 drops the new token too and is not retried: it becomes the error of the call (see [Error Handling](#error-handling)). A 403, such as `insufficient_scope`, is never retried.
- **Concurrency.** Concurrent calls in one process that need the same token from the same store, from one client or several, wait for a single mint.
- **Token service errors** reject any call that needs a new token with a `DidwwAuthError` (kinds in [Error Handling](#error-handling)):
  - A 429 rejects with `AuthErrorKind.RATE_LIMITED` and `retryAfter` (the `Retry-After` seconds, at least 1). Every further mint for the same token service and API key in the process fails the same way without a request until that time has passed, plus a small random delay so that clients do not retry in step. Such a refusal reports the time still left, so retry in a loop rather than once.
  - A 5xx answer, a connection failure, a timeout or an answer cut short is retried with exponential backoff and full jitter (0.5 s base, 8 s cap, 4 attempts in all), then rejects with `SERVER_ERROR` or `CONNECTION_ERROR`.
  - A 400, a 401, a TLS failure (such as an untrusted certificate) or a request that cannot be sent rejects at once, without a retry.

### Scope

```typescript
import { DidwwClient, Environment, Scope } from '@didww/sdk';

const readOnly = new DidwwClient({
  apiKey: 'your-api-key',
  environment: Environment.PRODUCTION,
  scope: Scope.READ, // GET and HEAD only; Scope.FULL allows every method
});
// Without scope no scope is sent and the token service grants full.
```

A `READ` token is enough for the price lookups and price files. A write with a `READ` token is answered 403, which the JSON:API repositories reject with a `DidwwApiError` (see [Error Handling](#error-handling)).

The SDK compares each token it receives with what it asked for:

- a different `scope` (for example `full` granted for a `read` request) or a different `api_version` is logged as a warning (see [Logging](#logging)), and the token is used;
- a token with an empty access token, one that is not a valid header value, or one whose `aud` does not include the requested audience, rejects with `AuthErrorKind.INVALID_GRANT` and is not cached.

### Token cache

Tokens are cached in a token store, keyed by the token service URL, the API key (as a SHA-256 hash), the audience, the API version and the scope. The key is an opaque string starting with `didww:token:v1:`. Each entry is stored for the token's `expiresIn` seconds.

The default is one `MemoryTokenStore` in process memory, shared by every client of the process built without `tokenStore`, so an application that builds a client per request or per job still reuses its tokens; since the key covers the API key, clients of different accounts never see each other's tokens. Pass `tokenStore: new MemoryTokenStore()` to give a client a cache of its own.

Separate processes, such as `cluster` workers or several containers, each mint their own tokens unless they share a store; so do `worker_threads`, which load their own copy of the SDK. To share tokens, pass your own store: any object with these three methods, each of which may return a promise:

```typescript
import type { AccessToken } from '@didww/sdk';

interface TokenStore {
  /** The token stored under key, or null/undefined when there is none or it has expired. */
  get(key: string): AccessToken | null | undefined | Promise<AccessToken | null | undefined>;
  /** Store token under key for ttlSeconds; ttlSeconds <= 0 means no expiry. */
  set(key: string, token: AccessToken, ttlSeconds: number): void | Promise<void>;
  /** Remove the token stored under key, if any. */
  delete(key: string): void | Promise<void>;
}
```

The `TokenStore` interface is exported. `AccessToken` is immutable (`accessToken`, `tokenType`, `expiresIn`, `aud`, `scope`, `apiVersion`, `mintedAt`). `token.toData()` returns it under its wire names, the access token included, and `AccessToken.fromData(data)` builds it back, so that a store can persist it; `fromData` throws a `TypeError` for a value of the wrong type. `util.inspect`, `JSON.stringify` and `toString()` of a token never show the access token. A store backed by Redis, for example with [ioredis](https://github.com/redis/ioredis):

```typescript
import Redis from 'ioredis';
import { AccessToken, DidwwClient, Environment, type TokenStore } from '@didww/sdk';

class RedisTokenStore implements TokenStore {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<AccessToken | null> {
    const raw = await this.redis.get(key);
    return raw === null ? null : AccessToken.fromData(JSON.parse(raw));
  }

  async set(key: string, token: AccessToken, ttlSeconds: number): Promise<void> {
    const value = JSON.stringify(token.toData());
    if (ttlSeconds > 0) await this.redis.set(key, value, 'EX', Math.ceil(ttlSeconds));
    else await this.redis.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

const store = new RedisTokenStore(new Redis({ host: 'localhost', port: 6379, connectTimeout: 5_000, commandTimeout: 5_000 }));
const client = new DidwwClient({ apiKey: 'your-api-key', environment: Environment.PRODUCTION, tokenStore: store });
```

A shared store holds live bearer tokens, so protect it like the API key. Processes that share a store can each mint once when a token is missing.

A store that throws or rejects does not fail the call: the error is logged as a warning, and the call goes on with a newly minted token (a failed write leaves the token uncached). `get` must return an `AccessToken`, for example built with `AccessToken.fromData`, or `null`/`undefined`; any other value, such as the object of `toData()`, is logged as `DIDWW token store read failed` and ignored. Each call to a store other than `MemoryTokenStore` itself is given 10 seconds; after that the SDK stops waiting and goes on as if it had failed, but the store's own work keeps running, so bound its I/O as well, as with the Redis timeouts above. After a 401 the refused token is deleted from the store only while it is still the stored one, so that a token another process has just stored survives; a store that keeps returning the refused token, for example after a failed delete, does not get it reused.

**ES module and CommonJS loaded together.** A process that loads the SDK both with `import` and with `require` (for example through two dependencies) gets two copies of it, each with its own default store and its own record of mints in flight. That costs an extra mint per audience, nothing more; pass the same `tokenStore` to every client to share the tokens. A store may return tokens built by either copy, and a client sends a `JsonNumber` built by either copy as a number (`instanceof JsonNumber` recognises both). `instanceof` does not recognise the other classes of the other copy: compare `error.name` instead (see [Error Handling](#error-handling)).

### Logging

The SDK is silent by default. Pass a `logger` to see what happens around access tokens: any object with some of the methods `debug`, `info`, `warn` and `error`, each called as `(message, details?)`. `console` and winston fit as they are; a logger whose methods take `(details, message)`, such as pino, needs a small adapter, or it drops the details:

```typescript
import { DidwwClient, Environment, type DidwwLogger } from '@didww/sdk';

const client = new DidwwClient({ apiKey: 'your-api-key', environment: Environment.PRODUCTION, logger: console });

// A logger whose methods take (details, message), such as pino
declare const pinoLogger: { warn(obj: object, msg: string): void; debug(obj: object, msg: string): void };
const adapter: DidwwLogger = {
  warn: (message, details) => pinoLogger.warn(details ?? {}, message),
  debug: (message, details) => pinoLogger.debug(details ?? {}, message),
};
```

- `warn`: `DIDWW token scope mismatch` and `DIDWW token api_version mismatch` (followed by the requested and granted values), and token store failures (`DIDWW token store read failed`, `write failed`, `write skipped`, `delete failed`, with `{ error }` as details).
- `debug`: `DIDWW token minted`, with the `aud`, `scope`, `api_version`, `expires_in` and `duration_ms` in the message.

Neither the token nor the API key is ever logged, nor are request headers or bodies. A logger that throws, or returns a promise that rejects, does not fail the call.

### SDK design decisions

- **Audience strategy.** One token per audience, minted on first use, rather than one token naming every service. An account that never calls the prices services never requests their audiences, so a refused audience cannot break DID management, and every token is valid for one service only.
- **Cache store.** In-process memory by default, shared by the clients of the process, because applications often build a client per request or job. A shared store is opt-in through `tokenStore`. Lifetime is decided by the server through the 401 refresh, not by a local expiry margin.
- **Logger.** Silent unless you pass one, so that the SDK adds no dependency and prints nothing on its own.
- **HTTP defaults.** Connect and read timeouts but no total timeout, so that large files are not cut off. No redirects, so that credentials stay on the configured hosts; no cookies, so that no state reaches the requests; no decompression of files, so that they are written as served. Node.js's `fetch` is not used: it always decodes a compressed answer and fixes its own connect timeout.
- **Gzip handling.** Price and export files are streamed to your path or stream exactly as served, still gzipped, without being held in memory. The SDK never decompresses a price file on its own: `PriceFileReader` reads a downloaded file when you want rows, and `downloadAndDecompressExport` writes an export as plain CSV.
- **Upload retry.** The 401 retry sends the request body a second time. `uploadEncryptedFile` builds the multipart body in memory once, so the retry always resends the complete body.
- **Errors.** One error class per subsystem with a `kind`, all derived from `DidwwError`, so that `catch (e) { if (e instanceof DidwwError) ... }` catches every API, token service, prices and transport failure. A destination that cannot be written rejects with its own error, as is (see [Error Handling](#error-handling)).
- **Exact numbers.** Money stays a decimal string, and numbers that a JavaScript `number` cannot hold exactly are kept as `JsonNumber` where they are sent back (see [Numbers](#numbers)).
- **Asynchronous waits.** The token backoff and the price file 503 retry wait on timers; they never block the event loop.

## Resources

### Read-Only Resources

```typescript
import { isIncluded, NumberType, type DidGroup } from '@didww/sdk';

// Countries
const countries = await client.countries().list();
const country = await client.countries().find('uuid');

// Regions
const regions = await client.regions().list();

// Cities, Areas
const cities = await client.cities().list();
const areas = await client.areas().list();

// DID Groups (with stock keeping units), filtered by number type
const groups = await client.didGroups().list({
  include: 'stock_keeping_units',
  filter: { number_type: NumberType.TOLL_FREE },
});
// Access included SKUs directly on each group
for (const group of groups.data) {
  const skus = group.stockKeepingUnits; // resolved array
  console.log(group.prefix, skus?.length, 'SKUs');
}

// Available DIDs (with DID group and stock keeping units)
const available = await client.availableDids().list({
  include: 'did_group.stock_keeping_units',
});
// Access nested includes
const ad = available.data[0];
const didGroup = ad.didGroup; // resolved DidGroup
const skus = isIncluded<DidGroup>(didGroup) ? didGroup.stockKeepingUnits : undefined; // resolved StockKeepingUnit[]
console.log(ad.number, skus?.length, 'SKUs');

// Other read-only resources
client.nanpaPrefixes();
client.proofTypes();
client.publicKeys();
client.addressRequirements();
client.supportingDocumentTemplates();

// Stock keeping units and qty-based pricings are include-only resources:
// - StockKeepingUnit: include on didGroups (see above)
// - QtyBasedPricing: include on capacityPools
const pools = await client.capacityPools().list({ include: 'qty_based_pricings' });

// Balance (singleton)
const balance = await client.balance().find();
```

`DidGroup`, `AddressRequirement`, `EmergencyRequirement` and `EmergencyCallingService` carry `numberType`, one of the `NumberType` values (`LOCAL`, `NATIONAL`, `MOBILE`, `TOLL_FREE`, `SHARED_COST`, `GLOBAL`), or a plain string for a number type this SDK does not know; filter with the `number_type` key. `DidGroup.isDemo` flags demo groups. `NumberType` replaces the `DidGroupType` resource and the `did_group_type` relationship, which API `2026-10-22` no longer has. The `pops` resource is gone too: a Voice IN trunk carries its point of presence in the `pop` attribute (see [Voice In Trunks](#voice-in-trunks)).

```typescript
import { NumberType } from '@didww/sdk';

const { data: group } = await client.didGroups().find('uuid');
if (group.numberType === NumberType.TOLL_FREE && !group.isDemo) {
  console.log(group.numberType); // "toll_free"
}
```

### DIDs

```typescript
import { ref } from '@didww/sdk';

// List DIDs
const dids = await client.dids().list();

// Assign a trunk to a DID (automatically nullifies trunk group)
await client.dids().update({
  id: 'did-id',
  voiceInTrunk: ref('voice_in_trunks', 'trunk-id'),
});

// Assign capacity pool and update attributes in one call
await client.dids().update({
  id: 'did-id',
  capacityPool: ref('capacity_pools', 'pool-id'),
  dedicatedChannelsCount: 1,
  capacityLimit: 5,
  description: 'Updated',
});

// Unassign a trunk (set to null)
await client.dids().update({
  id: 'did-id',
  voiceInTrunk: null,
});
```

#### SMS routing

A DID's inbound messages go to an SMS trunk or to an SMS trunk group. The two are exclusive: assigning `smsTrunk` also sends `smsTrunkGroup` as `null` in the same request, and assigning `smsTrunkGroup` sends `smsTrunk` as `null`. Assigning both in one update rejects with a `DidwwClientError` before any request. `null` sends only that relationship as `null`; set both to `null` to unroute the DID.

```typescript
import { ref } from '@didww/sdk';

// sends sms_trunk and sms_trunk_group: null
await client.dids().update({ id: 'did-id', smsTrunk: ref('sms_trunks', 'sms-trunk-id') });

// sends sms_trunk_group and sms_trunk: null
await client.dids().update({ id: 'did-id', smsTrunkGroup: ref('sms_trunk_groups', 'sms-trunk-group-id') });

// unroute: sends sms_trunk: null and sms_trunk_group: null
await client.dids().update({ id: 'did-id', smsTrunk: null, smsTrunkGroup: null });

const routed = await client.dids().list({
  filter: { 'sms_trunk.id': 'sms-trunk-id' },
  include: 'sms_trunk,sms_trunk_group',
}); // did.smsTrunk, did.smsTrunkGroup
```

An SMS trunk cannot be deleted while DIDs are routed to it, nor an SMS trunk group while DIDs are routed to it or to one of its trunks: unroute those DIDs, or route them elsewhere, first.

### Voice In Trunks

```typescript
import { sipConfiguration, pstnConfiguration, Codec, Pop, TransportProtocol } from '@didww/sdk';

// Create SIP trunk
const trunk = await client.voiceInTrunks().create({
  name: 'My SIP Trunk',
  configuration: sipConfiguration({
    host: 'sip.example.com',
    port: 5060,
    codecIds: [Codec.PCMU, Codec.PCMA],
    transportProtocolId: TransportProtocol.UDP,
  }),
  pop: Pop.FRA, // optional; leave it out to let DIDWW choose
});

// Create PSTN trunk
const pstnTrunk = await client.voiceInTrunks().create({
  name: 'My PSTN Trunk',
  configuration: pstnConfiguration({ dst: '12125551234' }),
});

// Update trunk
await client.voiceInTrunks().update({
  id: trunk.data.id,
  name: 'Updated Name',
});

// Delete trunk
await client.voiceInTrunks().remove(trunk.data.id);
```

`pop` is a plain attribute, one of the `Pop` values (`NYC`, `FRA`, `LAC`, `MIA`, `SG`, `HK`, `AMS`). Leave it out to let DIDWW choose; `pop: null` sends `"pop": null`. Like `cliFormat`, it is typed with its enum (`Pop | null`) for reading and writing alike, so a loaded trunk passes back to `update()` as it is; a point of presence added to the API later arrives as its raw string, which that type does not list. It is no longer a relationship and cannot be included.

```typescript
import { Pop } from '@didww/sdk';

await client.voiceInTrunks().update({ id: 'trunk-id', pop: Pop.AMS });
```

#### SIP Registration (2026-04-16)

A Voice In Trunk can also authenticate inbound calls via SIP registration
credentials generated by DIDWW. The SDK auto-cascades the dependent fields
the server requires inside `serializeTrunkConfiguration`:

* `enabledSipRegistration: true` strips `host` / `port` from the wire
  (the server rejects them with 422 otherwise);
* a non-empty `host` flips `enabledSipRegistration` to `false` and
  forces `useDidInRuri: false` on the wire so the server accepts the
  disable PATCH.

The server generates `incomingAuthUsername` and `incomingAuthPassword`
and surfaces them in the response when SIP registration is enabled.

```typescript
import { sipConfiguration, Codec, type SipConfiguration } from '@didww/sdk';

const trunk = await client.voiceInTrunks().create({
  name: 'Office (registered)',
  configuration: sipConfiguration({
    enabledSipRegistration: true,
    useDidInRuri: true,
    cnamLookup: true,
    codecIds: [Codec.PCMU, Codec.PCMA],
  }),
});
const config = trunk.data.configuration as SipConfiguration;
// config.incomingAuthUsername — server-generated
// config.incomingAuthPassword — server-generated
```

To disable SIP registration on an existing trunk, just set `host` — the
cascade flips `enabledSipRegistration` and `useDidInRuri` to `false`
automatically on the wire:

```typescript
await client.voiceInTrunks().update({
  id: trunk.data.id,
  configuration: sipConfiguration({ host: 'sip.example.com', codecIds: [Codec.PCMU, Codec.PCMA] }),
});
```

### Voice In Trunk Groups

```typescript
const group = await client.voiceInTrunkGroups().create({
  name: 'Primary Group',
  capacityLimit: 50,
});
```

### Voice Out Trunks

> **Note:** Voice Out Trunks and some `OnCliMismatchAction` values (`REPLACE_CLI`, `RANDOMIZE_CLI`) require additional account configuration. Contact DIDWW support to enable these features.

Voice Out Trunks use a polymorphic `authenticationMethod` (2026-04-16). Three types are supported:

- **`credentials_and_ip`** -- default method; `username` and `password` are server-generated and returned in the response.
- **`twilio`** -- requires a `twilioAccountSid`.
- **`ip_only`** -- read-only; can only be configured by DIDWW staff upon request. Cannot be set via the API.

```typescript
import {
  DefaultDstAction,
  OnCliMismatchAction,
  credentialsAndIpAuthenticationMethod,
  type CredentialsAndIpAuthenticationMethod,
} from '@didww/sdk';

// NOTE: 203.0.113.0/24 is RFC 5737 TEST-NET-3 documentation space.
// Replace with the real CIDR of your SIP infrastructure.
const voTrunk = await client.voiceOutTrunks().create({
  name: 'My Outbound Trunk',
  // username and password are server-generated, so they are left out
  // (the builder's input type lists them as required)
  authenticationMethod: credentialsAndIpAuthenticationMethod({
    allowedSipIps: ['203.0.113.0/24'],
    techPrefix: '',
  } as Omit<CredentialsAndIpAuthenticationMethod, 'type'>),
  defaultDstAction: DefaultDstAction.ALLOW_ALL,
  onCliMismatchAction: OnCliMismatchAction.REJECT_CALL,
});
// voTrunk.data.authenticationMethod.username -- server-generated
// voTrunk.data.authenticationMethod.password -- server-generated
```

### SMS Trunks

An SMS trunk delivers inbound messages, accepts outbound ones, or both. Its `configuration` is one of five types, each with a builder:

| Type | Builder | Notes |
|------|---------|-------|
| `sms_to_email` | `smsToEmailConfiguration({ ... })` | Inbound messages are forwarded as email. `sendTo`, `subject` and `message` are required. |
| `http_in` | `smsHttpInConfiguration({ ... })` | Inbound messages are sent as an HTTP request to your `url`. `httpMethod` is one of the `SmsHttpMethod` values (`GET`, `POST`, `PUT`); `POST` and `PUT` also need `bodyType` (an `SmsBodyType` value) and `body`, which `GET` refuses. `body` is a JSON string for `SmsBodyType.JSON`, an object of form fields for the form encodings and a string for `SmsBodyType.RAW`. The keys of `queryParameters`, `headers` and a form `body` are sent exactly as given. Query parameters, headers and body may use the placeholders `{SMS_TEXT}`, `{SMS_TEXT_BASE64_ENCODED}`, `{SMS_SRC_ADDR}`, `{SMS_DST_ADDR}` and `{SMS_TIME}`. |
| `http_out` | `smsHttpOutConfiguration({ ... })` | You submit outbound messages over HTTP. `authName` and `authPassword` are generated. The submit URL is `trunk.meta?.host`. |
| `smpp_esme` | `smsSmppEsmeConfiguration({ ... })` | You bind to DIDWW as an SMPP ESME. `serverLocation` is required; `systemId` and `password` are generated. |
| `smpp_smsc` | `smsSmppSmscConfiguration({ ... })` | DIDWW binds to your SMSC with your `host`, `systemId`, `password` and `serverLocation`. `txPort` defaults to 2775 and `rxPort` to 2776. |

`configuration.type` is the wire type (also in `SmsTrunkConfigurationType`). The read-only `trunk.allowIn` and `trunk.allowOut` tell which directions a trunk handles. `priority` (0 to 32767, default 100) must stay unset on `http_out` trunks, where it reads as `null`. `serverLocation` is `SmsServerLocation.NYC` or `SmsServerLocation.AMS`; the sandbox accepts `nyc` only.

```typescript
import { SmsBodyType, SmsHttpMethod, smsHttpInConfiguration } from '@didww/sdk';

const created = await client.smsTrunks().create({
  name: 'Inbound webhook',
  configuration: smsHttpInConfiguration({
    url: 'https://example.com/sms',
    httpMethod: SmsHttpMethod.POST,
    bodyType: SmsBodyType.JSON,
    body: '{"text":"{SMS_TEXT}","from":"{SMS_SRC_ADDR}","to":"{SMS_DST_ADDR}"}',
  }),
});

// On update the configuration type must stay the same; attributes left out keep their values.
await client.smsTrunks().update({
  id: created.data.id,
  configuration: smsHttpInConfiguration({ url: 'https://example.com/sms/v2' }),
});

// An attribute set to null is sent as null, which clears it
await client.smsTrunks().update({
  id: created.data.id,
  configuration: smsHttpInConfiguration({ httpMethod: SmsHttpMethod.GET, bodyType: null, body: null }),
});

// List by configuration type, with the group
const trunks = await client.smsTrunks().list({
  filter: { 'configuration.type': ['http_in', 'sms_to_email'] },
  include: 'sms_trunk_group',
});
```

A typed configuration sends every writable attribute that is not `undefined` (`null` clears it) and never the read-only credentials; an attribute left out keeps its stored value. A loaded configuration can be edited in place: the next update sends it as a whole, and an unchanged one is not sent.

`SmsTrunkConfiguration` is a union of the five types and `GenericSmsTrunkConfiguration`, whose `type` is any string, so **`switch (config.type)` does not narrow it**. Use the type guards `isSmsToEmail`, `isSmsHttpIn`, `isSmsHttpOut`, `isSmsSmppEsme`, `isSmsSmppSmsc` and `isGenericSmsTrunkConfiguration`:

```typescript
import { isSmsHttpIn } from '@didww/sdk';

const { data: trunk } = await client.smsTrunks().find('sms-trunk-id');
if (isSmsHttpIn(trunk.configuration)) {
  trunk.configuration.url = 'https://example.com/sms/v3';
  await client.smsTrunks().update(trunk); // sends the whole configuration
}
```

`outgoingDids: [...]` replaces the whole `outgoing_dids` list of the trunk: list every DID to keep (include `outgoing_dids` to read the current list), or pass `[]` (or `null`) to clear it. `outgoingDids` must stay empty while `allowAnyDidAsSource` is on, so turning `allowAnyDidAsSource` on also clears an `outgoingDids` list that was loaded with `include: 'outgoing_dids'`. `incomingDids` and `senderIdVerifications` can be included but are read-only and never sent. `smsTrunkGroup: null` takes the trunk out of its group.

**Generic configuration.** A configuration type this SDK does not know is read as a `GenericSmsTrunkConfiguration`: `{ type, attributes }`, with the attributes under their wire names and their numbers exact (see [Numbers](#numbers)). `genericSmsTrunkConfiguration(type, attributes)` builds one to send a configuration exactly as written: keys are never renamed, and every value, `null` included, is sent as is; read-only attributes are not stripped. A typed object whose `type` the SDK does not know is refused with a `DidwwClientError`.

```typescript
import { genericSmsTrunkConfiguration } from '@didww/sdk';

await client.smsTrunks().update({
  id: 'sms-trunk-id',
  configuration: genericSmsTrunkConfiguration('http_in', { url: 'https://example.com/sms', http_method: 'get' }),
});
```

**Credentials.** The generated credentials of `http_out` and `smpp_esme` trunks are read-only and are never sent in a request. `util.inspect`, `console.log` and `JSON.stringify` of a configuration returned by the API or built by a builder mask them, the `password` of an `smpp_smsc` configuration, and the `headers` of an `http_in` configuration, which may carry the credentials of your endpoint, as `[FILTERED]`; a generic configuration masks every attribute value that is not `null`. The properties themselves return the real values. **A spread copy (`{ ...config }`) is not masked**: pass a configuration through `redactSmsTrunkConfiguration(config)` before logging a copy. To rotate the generated credentials:

```typescript
import { isSmsHttpOut, isSmsSmppEsme, ref } from '@didww/sdk';

await client.smsTrunkRegenerateCredentials().create({ smsTrunk: ref('sms_trunks', 'sms-trunk-id') });

// The response carries no credentials: read the trunk again
const { data: outTrunk } = await client.smsTrunks().find('sms-trunk-id');
const configuration = outTrunk.configuration;
if (isSmsHttpOut(configuration)) {
  // configuration.authName and configuration.authPassword are the new credentials
} else if (isSmsSmppEsme(configuration)) {
  // configuration.systemId and configuration.password are the new credentials
}
```

### SMS Trunk Groups

An SMS trunk group spreads a DID's inbound messages over its trunks by their `priority` (the higher value first). `http_out` trunks cannot join a group. Deleting a group also deletes the trunks in it.

```typescript
import { ref } from '@didww/sdk';

const created = await client.smsTrunkGroups().create({
  name: 'Inbound SMS',
  smsTrunks: [ref('sms_trunks', 'sms-trunk-id')],
});
console.log(created.data.meta?.smsTrunksCount); // 1
```

`smsTrunks: [...]` replaces the whole membership of the group: list every trunk to keep. Build the list from the included `smsTrunks`:

```typescript
import { ref } from '@didww/sdk';

const { data: current } = await client.smsTrunkGroups().find('sms-trunk-group-id', { include: 'sms_trunks' });
const members = (current.smsTrunks ?? []).map((trunk) => ref('sms_trunks', trunk.id));
members.push(ref('sms_trunks', 'another-sms-trunk-id'));
await client.smsTrunkGroups().update({ id: current.id, smsTrunks: members });

// An empty list (or null) removes every trunk from the group
await client.smsTrunkGroups().update({ id: 'sms-trunk-group-id', smsTrunks: [] });
```

`incomingDids` can be included but is read-only.

### Sender ID Verifications

A Sender ID verification covers the sender IDs your outbound messages use. It is created and reviewed outside the API: the API lists and reads verifications, and changes only their `name` and the SMS trunk their messages are routed through. A closed verification cannot be changed. `status` is one of the `SenderIdVerificationStatus` values and `senderType` one of the `SenderType` values; `isSenderIdVerificationActive(v)`, `isSenderIdVerificationClosed(v)` and the other `isSenderIdVerification*` helpers test the status. `verification.meta?.setupPrice` and `verification.meta?.monthlyPrice` hold the prices as decimal strings.

```typescript
import { ref, SenderIdVerificationStatus } from '@didww/sdk';

const { data: verifications } = await client.senderIdVerifications().list({
  filter: { status: SenderIdVerificationStatus.ACTIVE },
  include: 'sms_trunk',
});

// http_out, smpp_esme or smpp_smsc trunks only
await client.senderIdVerifications().update({
  id: verifications[0].id,
  smsTrunk: ref('sms_trunks', 'sms-trunk-id'),
});

// Outbound messages stop until a trunk is assigned again
await client.senderIdVerifications().update({ id: verifications[0].id, smsTrunk: null });
```

Deleting an SMS trunk leaves the verifications routed through it without a trunk. The other relationships (`countries`, `dids`, `order`, `identity`, `address`) can be included but are read-only and never sent.

### Orders

```typescript
import { didOrderItem, availableDidOrderItem, reservationDidOrderItem, capacityOrderItem } from '@didww/sdk';

// Order by SKU
const order = await client.orders().create({
  allowBackOrdering: true,
  items: [didOrderItem({ skuId: 'sku-id', qty: 2 })],
});

// Order a specific available DID
const order2 = await client.orders().create({
  items: [availableDidOrderItem({ skuId: 'sku-id', availableDidId: 'available-did-id' })],
});

// Order a reserved DID
const order3 = await client.orders().create({
  items: [reservationDidOrderItem({ skuId: 'sku-id', didReservationId: 'reservation-id' })],
});

// Order capacity
const order4 = await client.orders().create({
  items: [capacityOrderItem({ capacityPoolId: 'pool-id', qty: 1 })],
});
```

### DID Reservations

```typescript
const reservation = await client.didReservations().create({
  description: 'Reserved for client',
  availableDid: ref('available_dids', 'available-did-id'),
});

await client.didReservations().remove(reservation.data.id);
```

### Shared Capacity Groups

```typescript
const scg = await client.sharedCapacityGroups().create({
  name: 'Shared Group',
  sharedChannelsCount: 20,
  meteredChannelsCount: 5,
  capacityPool: ref('capacity_pools', 'pool-id'),
});
```

### Identities

```typescript
import { IdentityType, ref } from '@didww/sdk';

const identity = await client.identities().create({
  identityType: IdentityType.PERSONAL,
  firstName: 'John',
  lastName: 'Doe',
  phoneNumber: '12125551234',
  country: ref('countries', 'country-id'),
});
```

`companyWebsite` belongs to business identities; a personal identity refuses it. It is left out of a create request while `null`, and `companyWebsite: null` on update clears it.

```typescript
await client.identities().update({ id: 'identity-id', companyWebsite: 'https://www.example.com' });
```

### Addresses

```typescript
const address = await client.addresses().create({
  cityName: 'New York',
  postalCode: '10001',
  address: '123 Main St',
  identity: ref('identities', 'identity-id'),
  country: ref('countries', 'country-id'),
});
```

### Exports

```typescript
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { ExportType, isExportCompleted } from '@didww/sdk';

// Dates are "YYYY-MM-DD HH:MM:SS" in UTC: from is inclusive, to is exclusive and not in the future
const midnight = new Date();
midnight.setUTCHours(0, 0, 0, 0);
const format = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');
const from = format(new Date(midnight.getTime() - 86_400_000));
const to = format(midnight);

const exp = await client.exports().create({
  exportType: ExportType.CDR_IN,
  filters: { from, to },
});

// SMS export
const smsOut = await client.exports().create({
  exportType: ExportType.SMS_OUT,
  filters: { from, to, serviceType: 'a2p', 'smsTrunk.id': ['sms-trunk-id'] },
});

// The export is pending until its file is generated; read it again later
const { data: completed } = await client.exports().find(smsOut.data.id);
if (isExportCompleted(completed) && completed.url) {
  const gzipped = await client.downloadExport(completed.url); // Buffer, gzipped CSV as served
  await client.downloadExport(completed.url, 'export.csv.gz'); // a file path
  await client.downloadAndDecompressExport(completed.url, 'export.csv'); // plain CSV

  const out = createWriteStream('copy.csv.gz'); // any writable stream, left open
  await client.downloadExport(completed.url, out);
  out.end();
  await finished(out);
}
```

`downloadExport(url)` and `downloadAndDecompressExport(url)` return the file as a `Buffer`; with a second argument, a file path or a writable stream, they write it there and return nothing. They send the token only to the origin (scheme, host and port) of the JSON:API base URL or of the environment, so export URLs, which the API builds on the environment's host, are still downloaded when `baseUrl` points elsewhere. A URL on any other origin rejects with a `DidwwClientError`, and nothing is sent. Only a 200 answer is written, as it arrives, exactly as served; redirects are not followed, and any other status, a 3xx or a 204 included, rejects with a `DidwwApiError` (see [Error Handling](#error-handling)). A file whose size differs from its `Content-Length`, a transfer that breaks off and gzip data that cannot be decompressed reject with a `DidwwClientError`. `downloadAndDecompressExport` reads every gzip member; a zero byte after a member and everything that follows it are ignored as padding, as `gzip -d` does, however the file arrives.

A path destination is written to a temporary file next to it, which replaces it (a rename) only once the whole file has arrived (or has been decompressed) and has been flushed to the disk; after a failure an existing file is left as it was. The temporary file is created before the request, so a missing directory fails without one. The new file gets the permissions of a new file (`0o666` minus the umask on POSIX systems), not those of the file it replaces, and a symlink at the path is replaced, not followed. A stream destination is written as the data arrives and is not ended, so it may hold part of the file after a failure; a stream that is already closed is refused with a `DidwwClientError`. Errors of the file system or of the stream itself (also one the stream emits during the call, such as `ENOENT` from `createWriteStream`) reject as they are. Any other destination rejects with a `TypeError`.

`from` and `to` are required for every export type (`cdr_in`, `cdr_out`, `sms_in`, `sms_out`). Write the other `ExportFilters` keys in camelCase, as in the example; the SDK sends them in snake_case (`sourceAddressEq` as `source_address_eq`, `'smsTrunk.id'` as `sms_trunk.id`). They depend on the type:

- `cdr_in`: `didNumber`, `sourceNumber`, `sourceNumberOut`, `sourceCountryIso`;
- `cdr_out`: `source`, `cli`, `destination` (and `voice_out_trunk.id`, see [`FILTERS.md`](FILTERS.md#export-filters--filters-of-post-v3exports));
- `sms_in` and `sms_out`: `sourceAddressEq`, `sourceAddressCont`, `destinationAddressEq`, `destinationAddressCont`, `status`, `smsId`, `'smsTrunk.id'` (a string or an array of strings);
- `sms_in` only: `trunkType`, one or more of the `ExportTrunkType` values (`SMPP SMSC`, `SMPP ESME`, `Email`, `HTTP IN`);
- `sms_out` only: `serviceType` (`a2p` or `p2p`) and `'senderIdVerification.id'` (a string or an array of strings).

### Address Verifications

```typescript
import { CallbackMethod, ref } from '@didww/sdk';

// List address verifications
const verifications = await client.addressVerifications().list();

// Create address verification
const verification = await client.addressVerifications().create({
  callbackUrl: 'https://example.com/callback',
  callbackMethod: CallbackMethod.POST,
  address: ref('addresses', 'address-id'),
  dids: [ref('dids', 'did-id')],
});
```

### Emergency Services (2026-04-16)

```typescript
import { CallbackMethod, ref } from '@didww/sdk';

// List emergency requirements
const emergReqs = await client.emergencyRequirements().list();

// Create emergency verification
const emergVerification = await client.emergencyVerifications().create({
  callbackUrl: 'https://example.com/callback',
  callbackMethod: CallbackMethod.POST,
  address: ref('addresses', 'address-id'),
  dids: [ref('dids', 'did-id')],
});

// List emergency calling services
const emergServices = await client.emergencyCallingServices().list();
```

### DID History (2026-04-16)

```typescript
// List DID history
const history = await client.didHistory().list();
for (const entry of history.data) {
  console.log(entry.action, entry.createdAt);
}
```

## Prices

Prices are served by three services outside the JSON:API (hosts in [Environments](#environments)). Each price list has a price file and a lookup:

| Accessor | Service | Price file | Lookup | Lookup rows |
|----------|---------|------------|--------|-------------|
| `client.voiceInPrices()` | Voice IN | `prices.csv.gz` | `lookup/prices` | `VoiceInPrice` |
| `client.voiceOutPrices()` | Voice OUT | `prices.csv.gz` | `lookup/prices` | `VoiceOutPrice` |
| `client.smsOutA2pPrices()` | SMS | `sms_out/a2p/prices.csv.gz` | `sms_out/a2p/lookup/prices` | `SmsOutPrice` |
| `client.smsOutP2pPrices()` | SMS | `sms_out/p2p/prices.csv.gz` | `sms_out/p2p/lookup/prices` | `SmsOutPrice` |
| `client.smsOutOtpPrices()` | SMS | `sms_out/otp/prices.csv.gz` | `sms_out/otp/lookup/prices` | `SmsOutPrice` |
| `client.smsInPrices()` | SMS | `sms_in/prices.csv.gz` | `sms_in/lookup/prices` | `SmsInPrice` |

Each accessor returns a `PricesService`, with `filePath`, `lookupPath` and `allowedFilters`. The account needs a price plan of that service: without one, every call rejects with `PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED`.

### Price lookups

```typescript
import { VoiceOutPriceCategory } from '@didww/sdk';

const result = await client.voiceInPrices().lookup({ number: '18005550123', src_country_iso: 'US' });
console.log(result.totalRecords);
for (const price of result.rows) {
  if (price.rate !== null) {
    console.log(`${price.destination} ${price.sourceType}: ${price.rate} USD/min`);
  }
}

const voiceOut = await client.voiceOutPrices().lookup({ number: '493012345678' });
if (voiceOut.rows[0].category === VoiceOutPriceCategory.INTERNATIONAL) {
  console.log(voiceOut.rows[0].rate);
}
const a2p = await client.smsOutA2pPrices().lookup({ dst_number: '4915123456789' });
const smsIn = await client.smsInPrices().lookup({ dst_country_iso: 'US' });
```

| Service | Filters |
|---------|---------|
| Voice IN | `number` (required), `src_country_iso` |
| Voice OUT | `number` (required); no other filter |
| SMS OUT and SMS IN | `dst_number`, `dst_country_iso`; at least one |

Filter names are given without `filter[...]`, and values as strings (a number may also be given as a non-negative safe integer). The filter types of each accessor check the names at compile time. A missing or unknown filter rejects with a `DidwwClientError` before any request; `null`, `undefined` and blank values are dropped. The server checks the value formats and answers a bad value with 400 (`PricesErrorKind.BAD_REQUEST`). A lookup is not retried, except once with a new token after a 401.

`lookup` resolves to a `PriceLookup`: `rows` (a frozen array) and `totalRecords` (0 when the answer does not give it). It always holds at least one row: no match rejects with `PricesErrorKind.PRICE_NOT_FOUND`, never an empty result. The rows are frozen objects, and every field is checked: a value of the wrong type, or a missing field that the API always sends, rejects with a `DidwwClientError`.

- **Money stays a decimal string**, exactly as served with its scale (`"0.075000"`), in USD, VAT excluded: `rate`, `connectionFee`, `nextRate`, `nextConnectionFee` and `price`. It is never converted to a `number`, which would round it. A price is `null` when the row rejects the calls or messages (see `rejectCalls` and `rejectSms`). For arithmetic, use a decimal library such as [decimal.js](https://github.com/MikeMcl/decimal.js) or [big.js](https://github.com/MikeMcl/big.js):

  ```typescript
  import Decimal from 'decimal.js';

  const perMinute = result.rows[0].rate;
  if (perMinute !== null) console.log(new Decimal(perMinute).times(12).toFixed(6)); // 12 minutes
  ```
- Intervals, increments, number lengths, `mcc` and `mnc` are `number`. `VoiceOutPrice.effectiveAt` is an RFC 3339 string as served, and `VoiceOutPrice.category` one of the `VoiceOutPriceCategory` values (`INTERNATIONAL`, `ORIGIN_BASED`, `LOCAL`), or a plain string for a category this SDK does not know.
- The `id` of an SMS OUT or SMS IN lookup row is derived from its content: it changes when the row or its price changes, so do not use it to track a destination over time.

### Price files

The files are gzipped CSV with a header row. The SDK writes them exactly as served and never decompresses them.

```typescript
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { PriceFileReader } from '@didww/sdk';

const prices = client.voiceInPrices();
const path = 'voice_in_prices.csv.gz';

// Download unless the copy at the path is current
const file = await prices.fetch(path);
if (file.notModified) {
  console.log('answered 304, the file was kept');
} else {
  console.log(`downloaded ${file.bytesWritten} bytes, last modified ${file.lastModified?.toISOString()}`);
}

// Read the rows, keyed by the header line
const reader = new PriceFileReader(path);
let count = 0;
for await (const row of reader) {
  console.log(`${row['Destination']}: ${row['Rate (USD, excl. VAT)']}`);
  if (++count === 5) break; // closes the file
}

// Lower-level calls
const status = await prices.head({ ifModifiedSince: file.lastModified }); // null sends no If-Modified-Since
// status.notModified, status.contentLength (null when unknown),
// status.filename (from Content-Disposition, e.g. "voice_in_prices.csv.gz")

await prices.downloadToFile(path);
const out = createWriteStream('copy_of_voice_in_prices.csv.gz');
await prices.download(out, { ifModifiedSince: new Date('2026-10-01T00:00:00Z') }); // any writable stream, left open
out.end();
await finished(out);
```

- `fetch(path)` sends the modification time of the file at `path` as `If-Modified-Since`, when the file is there; an unchanged price file is answered 304 and the file is kept. A file written by `downloadToFile` or `fetch` gets the `Last-Modified` of the response as its modification time, so the date matches the copy on disk. `fetch` trusts the modification time of any file at `path`: a file copied or changed by other means can be answered 304 and kept, so replace such a file with `downloadToFile`.
- `ifModifiedSince` of `head` and `download` must be a valid `Date` whose UTC year is 1 to 9999, or `null`/`undefined`; anything else rejects with a `DidwwClientError`. It is sent in whole seconds as an HTTP date in GMT.
- `downloadToFile` and `fetch` stream the body into a temporary file next to `path`, unique to the call, which gets the permissions of a new file (`0o666` minus the umask on POSIX systems), is flushed to the disk and replaces `path` atomically (a rename) only on a complete 200. A 304 or an error leaves an existing file untouched, the temporary file is always removed, and concurrent downloads to one path do not mix their bytes. A directory that does not exist rejects with the `ENOENT` error of the file system, without a request. `path` must be a string: for a `file:` URL use `fileURLToPath`. **On Windows the replacement fails while `path` is open**, for example by a `PriceFileReader` whose iteration has not ended.
- `download(stream, options?)` writes the body into the stream only on a 200, as it arrives, so after a transfer error it may hold part of it. The stream is not ended. A destination that is not a writable stream, or one already closed, rejects with a `DidwwClientError`; an error of the stream itself, also one it emits during the call (such as `ENOENT` from `createWriteStream`), rejects as is.
- A body whose size differs from its `Content-Length` rejects with `PricesErrorKind.CONNECTION_ERROR`; it never replaces a file.
- `head` and the downloads resolve to a frozen `PriceFile`: `status` (200 or 304), `lastModified` (a `Date`, or `null` when absent or not an IMF-fixdate), `contentLength`, `filename` (as sent: check it before using it as a path), `bytesWritten` and `notModified`.
- `new PriceFileReader(source)` and `readPriceFile(source)` gunzip a downloaded file and iterate over its rows with `for await`, each a frozen object keyed by the header line, as served (for example `Rate (USD, excl. VAT)`). `source` is a file path, a `Buffer` or `Uint8Array`, a readable stream, a web `ReadableStream` (such as the `body` of a `fetch()` response) or an async iterable of bytes. A path is opened on the first iteration and closed when the iteration ends, also on `break`. When the iteration ends early or fails, a stream source is destroyed, a web `ReadableStream` is cancelled, also while it is waiting for data, and an async iterable is no longer read and is returned (its `finally` runs); `reader.close()` ends an iteration in progress, also one waiting for data, and closes a stream source or cancels a web `ReadableStream`, also one no iteration has read from yet. A reader is iterated once. A UTF-8 byte order mark and empty lines are skipped, and invalid UTF-8 reads as U+FFFD. A file of several gzip members is read in full. After a member, a zero byte and everything that follows it are ignored as padding (zlib does so), a later member included, however the input is split into chunks and however fast the rows are read. While the rows are read, input that is not valid gzip (a bad checksum, corrupt compressed data or two or more bytes after the gzip data that do not start with a zero byte) rejects with a zlib error of code `Z_DATA_ERROR`, and gzip data cut short, an empty input or a single byte after the gzip data with `Z_BUF_ERROR`; bad quoting, a row whose field count differs from the header or a record over the limits (1,024 fields, 1,048,576 characters in a field, 4,194,304 in the record) rejects with a `DidwwClientError`. After a CSV error the rows before it have been passed on. After a zlib error the last rows before the damage (tens of KiB of CSV, depending on the Node version and how fast rows are read, so all rows of a small file) may not have been passed on.
- Only `Last-Modified` and `If-Modified-Since` are used, in whole seconds. The service sends no `ETag`, and the SDK never sends `If-None-Match`, which would make the service ignore `If-Modified-Since`.
- A 503 on a price file is retried up to 2 times when its `Retry-After` is 60 seconds or less, after waiting that long (at least 1 s) plus a small random delay so that clients do not retry in step. Otherwise it rejects with `PricesErrorKind.SERVICE_UNAVAILABLE` and `retryAfter`. Lookups and other statuses, 429 included, are not retried.
- A 404 `price_not_found` rejects with `PRICE_NOT_FOUND`; any other 404, `price_plan_not_assigned` included, and any 404 on `head`, which has no body, rejects with `PRICE_PLAN_NOT_ASSIGNED`. `DidwwPricesError.code` holds the code of the answer, or `price_plan_not_assigned` for a 404 without one.
- Redirects are not followed. A status without its own kind in [Error Handling](#error-handling), such as a 3xx, a 202 or a 204, rejects with `PricesErrorKind.UNEXPECTED_STATUS`. An error is never turned into an empty file or an empty result.

## Included Resources

Use the `include` parameter to sideload related resources. Included relationships are resolved directly on the parent object:

A relationship that was not included is absent (`undefined`): the API sends the linkage of a relationship only when it is requested with `include`, and otherwise only its links, so include a relationship to read it. A relationship holds only its `{ id, type }` reference where the document carries its linkage but the result does not place the resource there, which is below the end of an include path that leads back to a resource of the same document (see below). Its type is therefore a union: narrow it with `isIncluded`.

The result follows the include paths of the request. Every relationship on a path holds the included resource, at any depth and whatever the order of the data, also where a path leads back to a resource met higher up: with `include: 'outgoing_dids.sms_trunk'`, the `smsTrunk` of each outgoing DID is the full trunk, even when it is a trunk of the same page. A relationship below the end of a path holds at most its `{ id, type }` (there, the `outgoingDids` of that `smsTrunk` when it is a trunk of the same page; absent when the API sends only links), so the result has no cycles and `JSON.stringify` can write it. A resource that appears several times at the same place of the paths is one shared object.

```typescript
import {
  isIncluded,
  type CapacityPool,
  type Country,
  type DidGroup,
  type StockKeepingUnit,
  type VoiceInTrunk,
} from '@didww/sdk';

// Regions with their country
const regions = await client.regions().list({
  include: 'country',
});
for (const region of regions.data) {
  if (isIncluded<Country>(region.country)) console.log(region.name, region.country.name);
}

// DID groups with nested stock keeping units
const groups = await client.didGroups().list({
  include: 'stock_keeping_units',
});
for (const group of groups.data) {
  for (const sku of group.stockKeepingUnits || []) {
    if (isIncluded<StockKeepingUnit>(sku)) console.log(group.prefix, sku.monthlyPrice);
  }
}

// Available DIDs with nested includes (did_group → stock_keeping_units)
const available = await client.availableDids().list({
  include: 'did_group.stock_keeping_units',
});
const ad = available.data[0];
const skuId = isIncluded<DidGroup>(ad.didGroup) ? ad.didGroup.stockKeepingUnits?.[0]?.id : undefined;

// DIDs with voice trunk and capacity pool
const dids = await client.dids().list({
  include: 'voice_in_trunk,capacity_pool',
});
for (const did of dids.data) {
  const trunk = isIncluded<VoiceInTrunk>(did.voiceInTrunk) ? did.voiceInTrunk.name : null;
  const pool = isIncluded<CapacityPool>(did.capacityPool) ? did.capacityPool.name : null;
  console.log(did.number, trunk, pool);
}
```

## Query Parameters

> See [`FILTERS.md`](FILTERS.md) for the list of `filter[KEY]` keys accepted by every list endpoint at API version `2026-10-22`.

```typescript
const result = await client.regions().list({
  filter: { 'country.id': 'uuid', name: 'Arizona' },
  include: ['country'],
  sort: '-name',
  page: { number: 1, size: 25 },
});
```

## Dirty Tracking (PATCH Optimization)

When you fetch a resource from the API, the SDK snapshots its writable attributes and relationships. On update, only changed fields are sent in the PATCH request. Relationships loaded through an include are sent back only when you change them, and read-only relationships are never sent:

```typescript
// Load a DID from the API
const response = await client.dids().find('did-id', { include: 'voice_in_trunk' });
const did = response.data;

// Modify only what you need
did.description = 'Updated description';

// PATCH request body (JSON:API format):
// {
//   "data": {
//     "id": "did-id",
//     "type": "dids",
//     "attributes": { "description": "Updated description" }
//   }
// }
await client.dids().update(did);
```

When you build an object manually (without fetching first), all provided fields are sent:

```typescript
// All provided fields are sent because there is no clean snapshot
// PATCH request body (JSON:API format):
// {
//   "data": {
//     "id": "did-id",
//     "type": "dids",
//     "attributes": { "description": "Updated", "capacity_limit": 5 }
//   }
// }
await client.dids().update({
  id: 'did-id',
  description: 'Updated',
  capacityLimit: 5,
});
```

Included resources are also tracked — you can modify and update them directly:

```typescript
import { isIncluded, type VoiceInTrunkGroup } from '@didww/sdk';

const response = await client.dids().find('did-id', { include: 'voice_in_trunk_group' });
const group = response.data.voiceInTrunkGroup;

if (isIncluded<VoiceInTrunkGroup>(group)) {
  // group has a clean snapshot — only dirty fields are sent
  group.name = 'Renamed group';

  // PATCH request body (JSON:API format):
  // {
  //   "data": {
  //     "id": "<group-id>",
  //     "type": "voice_in_trunk_groups",
  //     "attributes": { "name": "Renamed group" }
  //   }
  // }
  await client.voiceInTrunkGroups().update(group);
}
```

Setting a field to `null` explicitly clears it; `null` unassigns a to-one relationship, and `[]` empties a to-many one:

```typescript
const response = await client.dids().find('did-id', { include: 'voice_in_trunk' });
const did = response.data;

// Explicitly clear the trunk relationship
did.voiceInTrunk = null;

// PATCH request body (JSON:API format):
// {
//   "data": {
//     "id": "did-id",
//     "type": "dids",
//     "relationships": {
//       "voice_in_trunk": { "data": null }
//     }
//   }
// }
await client.dids().update(did);
```

## Trunk Configuration Types

| Type | Factory                                           |
| ---- | ------------------------------------------------- |
| SIP  | `sipConfiguration({ host, port, codecIds, ... })` |
| PSTN | `pstnConfiguration({ dst })`                      |

For the SMS trunk configuration types, see [SMS Trunks](#sms-trunks).

## Order Item Types

| Type            | Factory                                                |
| --------------- | ------------------------------------------------------ |
| DID (by SKU)    | `didOrderItem({ skuId, qty })`                         |
| Available DID   | `availableDidOrderItem({ skuId, availableDidId })`     |
| Reservation DID | `reservationDidOrderItem({ skuId, didReservationId })` |
| Capacity        | `capacityOrderItem({ capacityPoolId, qty })`           |
| Emergency       | `emergencyOrderItem({ emergencyCallingServiceId, qty })` |

## Date and Datetime Fields

All date and datetime fields of resources and price rows are returned as ISO 8601 strings. JavaScript's `Date` object has known pitfalls (mutable, timezone handling, 0-indexed months), so the SDK intentionally keeps these as `string` and lets you parse them with the library of your choice.

- **Datetime fields** — ISO 8601 strings e.g. `"2024-01-15T10:00:00.000Z"`:
  - `createdAt` — present on most resources
  - `updatedAt` — `SmsTrunk`, `SmsTrunkGroup`
  - `expiresAt` — `Did`, `DidReservation`, `Proof`, `EncryptedFile` (nullable)
  - `activatedAt` — `EmergencyCallingService`, `SenderIdVerification` (nullable)
  - `canceledAt` — `EmergencyCallingService` (nullable)
  - `closedAt` — `SenderIdVerification` (nullable)
  - `effectiveAt` — `VoiceOutPrice` price lookup rows (nullable)
- **Date-only fields** — date strings e.g. `"1990-05-20"`:
  - `Identity.birthDate`
  - `CapacityPool.renewDate`, `EmergencyCallingService.renewDate` (nullable)
  - `SenderIdVerification.renewDate` — `null` once the verification is closed
  - `DidOrderItem.billedFrom`, `DidOrderItem.billedTo`
- **String fields** (not numeric):
  - `EmergencyRequirement.estimateSetupTime` — e.g. `"7-14 days"`, `"1"`
  - `EmergencyRequirement.requirementRestrictionMessage` — nullable

The HTTP dates of the price files are `Date` objects: `PriceFile.lastModified` and the `ifModifiedSince` option (see [Price files](#price-files)), as is `AccessToken.mintedAt`.

**Important changes from previous API versions:**
- `expireAt` renamed to `expiresAt` on `DidReservation` and `EncryptedFile`
- `renewDate` is a date-only string, NOT a datetime
- `estimateSetupTime` is a string, NOT a number

```typescript
const did = await client.dids().find('uuid');
console.log(did.data.createdAt);   // "2024-01-15T10:00:00.000Z"
console.log(did.data.expiresAt);   // null or "2025-01-15T10:00:00.000Z"

// Parse with your preferred library:
import { parseISO } from 'date-fns';
const date = parseISO(did.data.createdAt);
```

## Numbers

Money and other fractional values are strings as the API sends them (for example `balance.totalBalance`, the prices of `SenderIdVerification.meta` and the price lookup rows); integers are `number`.

The SDK parses JSON with its own parser, which keeps every digit, also on Node.js 18. A number becomes a plain `number` when that `number` prints back as the same text (`1.1`, `42`), and a `JsonNumber` otherwise (`1.10`, `9007199254740993`, `1e2`, `-0`). The repositories turn every `JsonNumber` into a `number`, so typed fields, `meta` and the `errors` of a `DidwwApiError` hold plain numbers, except in the `attributes` of a `GenericSmsTrunkConfiguration`, which keep the exact text and send it back unchanged (see [SMS Trunks](#sms-trunks)). The low-level `client.get(path, params)`, `client.post(path, body)` and `client.patch(path, body)` return the parsed document as is, with its `JsonNumber` values.

`JsonNumber` is immutable: `text` and `toString()` give the exact text, `valueOf()` the nearest `number` (digits beyond double precision are lost), `toJSON()` the text as a JSON string for serializers other than the SDK's, and `JsonNumber.from(value)` builds one from a `number`, a `bigint` or a numeric string. Compare two of them by `text`.

Request bodies are encoded by the SDK: a `JsonNumber` and a `bigint` are written as exact JSON numbers. `NaN` and `Infinity` are refused with a `DidwwClientError`.

## Enums

Type-safe enums are provided for all API constant fields:

```typescript
import {
  // String enums
  CallbackMethod, // POST, GET
  AddressVerificationStatus, // PENDING, APPROVED, REJECTED
  ExportType, // CDR_IN, CDR_OUT, SMS_IN, SMS_OUT
  ExportStatus, // PENDING, PROCESSING, COMPLETED
  ExportTrunkType, // SMPP_SMSC, SMPP_ESME, EMAIL, HTTP_IN (trunkType filter of sms_in exports)
  IdentityType, // PERSONAL, BUSINESS, ANY
  OrderStatus, // PENDING, CANCELED, COMPLETED
  OnCliMismatchAction, // SEND_ORIGINAL_CLI, REJECT_CALL, REPLACE_CLI*, RANDOMIZE_CLI* (requires account config)
  MediaEncryptionMode, // DISABLED, SRTP_SDES, SRTP_DTLS, ZRTP
  DefaultDstAction, // ALLOW_ALL, REJECT_ALL
  VoiceOutTrunkStatus, // ACTIVE, BLOCKED
  CliFormat, // RAW, E164, LOCAL
  AreaLevel, // WORLDWIDE, COUNTRY, AREA, CITY
  Feature, // VOICE_IN, VOICE_OUT, T38, SMS_IN, P2P, A2P, EMERGENCY, CNAM_OUT
  StirShakenMode, // DISABLED, ORIGINAL, PAI, ORIGINAL_PAI, VERSTAT
  EmergencyCallingServiceStatus, // ACTIVE, CANCELED, CHANGES_REQUIRED, IN_PROCESS, NEW, PENDING_UPDATE
  EmergencyVerificationStatus, // PENDING, APPROVED, REJECTED
  DiversionRelayPolicy, // NONE, AS_IS, SIP, TEL
  NumberType, // LOCAL, NATIONAL, MOBILE, TOLL_FREE, SHARED_COST, GLOBAL
  Pop, // NYC, FRA, LAC, MIA, SG, HK, AMS
  SmsTrunkConfigurationType, // SMS_TO_EMAIL, HTTP_IN, HTTP_OUT, SMPP_ESME, SMPP_SMSC
  SmsHttpMethod, // GET, POST, PUT
  SmsBodyType, // JSON, HTML_MULTIPART, HTML_URL_ENCODED, RAW
  SmsServerLocation, // NYC, AMS
  SenderIdVerificationStatus, // ACTIVE, CHANGES_REQUIRED, CLOSED, CLOSING_IN_PROCESS, IN_PROCESS, NEW
  SenderType, // ALPHANUMERIC, CARRIER, LONG_CODE, SHORT_CODE, TOLL_FREE
  VoiceOutPriceCategory, // INTERNATIONAL, ORIGIN_BASED, LOCAL
  // Integer enums
  TransportProtocol, // UDP=1, TCP=2, TLS=3
  RxDtmfFormat, // RFC_2833=1, SIP_INFO=2, RFC_2833_OR_SIP_INFO=3
  TxDtmfFormat, // DISABLED=1, RFC_2833=2, SIP_INFO_RELAY=3, SIP_INFO_DTMF=4
  SstRefreshMethod, // INVITE=1, UPDATE=2, UPDATE_FALLBACK_INVITE=3
  Codec, // TELEPHONE_EVENT=6, G723=7, G729=8, PCMU=9, PCMA=10, ...
  // Constant objects with a type of the same name
  Scope, // READ, FULL
  AuthErrorKind, // see Error Handling
  PricesErrorKind, // see Error Handling
} from '@didww/sdk';
```

`ReroutingDisconnectCode`, `DiversionInjectMode` and `NetworkProtocolPriority` are exported too. A value the API sends that this SDK does not know reads as a plain string.

## File Encryption & Upload

```typescript
import { Encrypt } from '@didww/sdk';

// Instance-based: fetches the public keys of DIDWW from the API automatically (publicKeys() is called without a token)
const enc = new Encrypt(client);
const fingerprint = await enc.getFingerprint();
const encrypted = await enc.encrypt(fileBuffer);

const id = await client.uploadEncryptedFile(fingerprint, {
  data: encrypted,
  description: 'My document',
  filename: 'document.pdf.enc',
});
```

Static functions are also available for manual key management:

```typescript
import { encryptWithKeys, calculateFingerprint, ref } from '@didww/sdk';
import { readFileSync } from 'node:fs';

const keys = await client.publicKeys().list();
const pems: [string, string] = [keys.data[0].key, keys.data[1].key];

const fingerprint = calculateFingerprint(pems);
const encrypted = encryptWithKeys(readFileSync('document.pdf'), pems);
const id = await client.uploadEncryptedFile(fingerprint, {
  data: encrypted,
  description: 'My document',
  filename: 'document.pdf.enc',
});

// Create proof with uploaded files
await client.proofs().create({
  proofType: ref('proof_types', 'type-id'),
  entity: ref('identities', 'identity-id'),
  files: [ref('encrypted_files', id)],
});
```

`uploadEncryptedFile(fingerprint, { data, description?, filename? })` uploads one file per request and resolves to the ID of the new encrypted file. `data` must be a `Buffer` or a `Uint8Array` (it rejects with a `TypeError` otherwise). The multipart body is built in memory once, so that the request can be sent again with a new token after a 401. An error status rejects with a `DidwwApiError` with the errors of the answer.

## Webhook Signature Validation

Validate incoming webhook callbacks from DIDWW using HMAC-SHA1 signature verification.

Initialize the validator with the callback secret that is enabled in the DIDWW User Panel (**APIs → DIDWW API 3 → Callback Secrets**). DIDWW signs every callback with it and sends callbacks only while a callback secret is enabled.

```typescript
import { RequestValidator } from '@didww/sdk';

const validator = new RequestValidator('your-callback-secret');

// In your webhook handler:
const valid = validator.validate(
  requestUrl, // full original URL
  payload, // Record<string, string> of payload key-value pairs
  signature, // value of X-DIDWW-Signature header
);
```

## Error Handling

The SDK's own errors derive from `DidwwError`. Their messages, `cause` chains and own enumerable properties never contain the API key or a token, so `console.log(error)`, which prints all of them, is safe; neither do `util.inspect` and `JSON.stringify` of the client, tokens, token stores and SMS trunk configurations.

```typescript
import { DidwwApiError, DidwwClientError } from '@didww/sdk';

try {
  await client.voiceInTrunks().find('nonexistent');
} catch (error) {
  if (error instanceof DidwwApiError) {
    console.log('Status:', error.status);
    for (const err of error.errors) {
      console.log(`Error: ${err.detail ?? err.title} (code: ${err.code})`);
    }
  } else if (error instanceof DidwwClientError) {
    console.log('Client error:', error.message, error.cause);
  } else {
    throw error;
  }
}
```

| Error | Rejected with for |
|-------|-------------------|
| `DidwwApiError` | An error status of the JSON:API repositories, of `uploadEncryptedFile` and of the export downloads, with `status`, `errors` (the JSON:API error objects; `[]` when the answer has none) and `body` (the parsed answer, read up to 1 MiB, or its text when it is not JSON). |
| `DidwwClientError` | A failure on the client side: an invalid constructor argument (see [Configuration](#configuration)), a JSON:API, upload or export call that fails in transport (a connection failure, a timeout or a TLS error; the Node.js error is the `cause`, and an SDK timeout has the code `ERR_DIDWW_CONNECT_TIMEOUT`, `ERR_DIDWW_READ_TIMEOUT` or `ERR_DIDWW_TOTAL_TIMEOUT`), a 2xx answer that is not valid JSON, a refused export URL, an export download that breaks off, is incomplete or cannot be decompressed, a price lookup answer that cannot be parsed or holds no prices, an invalid price lookup filter or price file argument, an operation the resource does not support, `smsTrunk` and `smsTrunkGroup` assigned together, and `NaN` or `Infinity` in a request body. |
| `DidwwAuthError` | The token service, from any call that needs a new token. |
| `DidwwPricesError` | The prices services. |

`DidwwApiError` also reports the authentication failures of the API: a 401 still answered after the token was replaced once (`status` 401), and a 403 such as `insufficient_scope` for a write with a `READ` token, which is never retried. Redirects are not followed: a 3xx answer of the JSON:API rejects with a `DidwwApiError` with that status, and the export downloads reject with one for any status other than 200, such as a 3xx or a 204.

The token service and prices errors carry a `kind`:

```typescript
import {
  AuthErrorKind,
  DidwwAuthError,
  DidwwError,
  DidwwPricesError,
  PricesErrorKind,
} from '@didww/sdk';

try {
  await client.smsOutA2pPrices().lookup({ dst_number: '4915123456789' });
} catch (error) {
  if (error instanceof DidwwAuthError) {
    if (error.kind === AuthErrorKind.RATE_LIMITED) {
      // Wait retryAfter seconds and try again; repeat while the kind is RATE_LIMITED.
      console.log(`Token service rate limit, retry after ${error.retryAfter} s`);
    } else if (error.kind === AuthErrorKind.INVALID_CLIENT) {
      console.log(`API key refused: ${error.message}`);
    } else {
      throw error;
    }
  } else if (error instanceof DidwwPricesError) {
    if (error.kind === PricesErrorKind.PRICE_NOT_FOUND) {
      console.log('No price for this number');
    } else if (error.kind === PricesErrorKind.TOO_MANY_REQUESTS) {
      console.log(`Prices rate limit, retry after ${error.retryAfter} s`);
    } else {
      throw error;
    }
  } else if (error instanceof DidwwError) {
    console.log(`Error: ${error.message}`);
  } else {
    throw error;
  }
}
```

**Token service** (`DidwwAuthError`, with `kind`, `status`, `error`, `errorDescription` and `retryAfter`):

| `AuthErrorKind` | Rejected when |
|-----------------|---------------|
| `INVALID_CLIENT` | 401: the token service refused the API key. Not retried. |
| `INVALID_REQUEST` | 400, e.g. `invalid_request` or `invalid_scope`. |
| `RATE_LIMITED` | 429. `retryAfter` is the server's wait in seconds. Further mints fail without a request until that time plus a small random delay has passed; such a refusal reports the time still left in `retryAfter`, so retry in a loop rather than once. |
| `SERVER_ERROR` | 5xx on the last of the 4 attempts. |
| `CONNECTION_ERROR` | Connection failure, timeout or an answer cut short on the last attempt, a TLS failure (not retried), or a request that could not be sent. `status` is `null` unless an answer arrived. |
| `INVALID_GRANT` | The token is empty, not a valid header value, or does not cover the requested audience. |
| `UNEXPECTED_STATUS` | Any other status, such as a redirect. |

**Prices** (`DidwwPricesError`, with `kind`, `status`, `code`, `errors` and `retryAfter`):

| `PricesErrorKind` | Status |
|-------------------|--------|
| `BAD_REQUEST` | 400, e.g. a filter value of the wrong format |
| `NOT_AUTHORIZED` | 401 after the token was replaced once |
| `ACCESS_DENIED` | 403 |
| `PRICE_PLAN_NOT_ASSIGNED` | 404 `price_plan_not_assigned`, and any other 404 except `price_not_found`, including any 404 on `head`, which has no body |
| `PRICE_NOT_FOUND` | 404 `price_not_found`: no price matches the lookup |
| `NOT_ACCEPTABLE` | 406 |
| `TOO_MANY_REQUESTS` | 429, with `retryAfter` when the service sends it in seconds. Not retried. |
| `SERVICE_UNAVAILABLE` | 503, with `retryAfter`. Retried on price files only, see [Price files](#price-files). |
| `UNEXPECTED_STATUS` | Any other status, such as a redirect, a 202, a 204 or a 304 to a lookup |
| `CONNECTION_ERROR` | Connection failure, timeout, TLS failure, or a response body that breaks off or whose size differs from its `Content-Length`. Not retried. |

The prices services can also reject with a `DidwwAuthError`, and with a `DidwwClientError` for invalid arguments and for a 200 lookup answer that is not a JSON:API document it can parse or holds no prices. The errors of a destination stream and of the file system (temporary file, times, replacement) reject as they are, for the price files and the export downloads alike, and so do the zlib errors of a damaged price file read with `PriceFileReader`. Outside `DidwwError`, the SDK also rejects with a `TypeError` for an argument of the wrong type, such as upload `data` that is not bytes or an export destination that is neither a path nor a writable stream, and `AccessToken.fromData` throws one for malformed token data.

When the SDK is loaded both as an ES module and as CommonJS in one process, `instanceof` does not recognise the error classes of the other copy; `error.name` (`'DidwwApiError'`, `'DidwwClientError'`, `'DidwwAuthError'`, `'DidwwPricesError'`) does.

## All Supported Resources

| Resource                          | Repository                                    | Operations                         |
| --------------------------------- | --------------------------------------------- | ---------------------------------- |
| Country                           | `client.countries()`                          | list, find                         |
| Region                            | `client.regions()`                            | list, find                         |
| City                              | `client.cities()`                             | list, find                         |
| Area                              | `client.areas()`                              | list, find                         |
| NanpaPrefix                       | `client.nanpaPrefixes()`                      | list, find                         |
| DidGroup                          | `client.didGroups()`                          | list, find                         |
| AvailableDid                      | `client.availableDids()`                      | list, find                         |
| ProofType                         | `client.proofTypes()`                         | list, find                         |
| PublicKey                         | `client.publicKeys()`                         | list, find                         |
| AddressRequirement                | `client.addressRequirements()`                | list, find                         |
| SupportingDocumentTemplate        | `client.supportingDocumentTemplates()`        | list, find                         |
| StockKeepingUnit                  | include on `didGroups()`                      | include only                       |
| QtyBasedPricing                   | include on `capacityPools()`                  | include only                       |
| Balance                           | `client.balance()`                            | find                               |
| Did                               | `client.dids()`                               | list, find, update, delete         |
| VoiceInTrunk                      | `client.voiceInTrunks()`                      | list, find, create, update, delete |
| VoiceInTrunkGroup                 | `client.voiceInTrunkGroups()`                 | list, find, create, update, delete |
| VoiceOutTrunk                     | `client.voiceOutTrunks()`                     | list, find, create, update, delete |
| VoiceOutTrunkRegenerateCredential | `client.voiceOutTrunkRegenerateCredentials()` | create                             |
| SmsTrunk                          | `client.smsTrunks()`                          | list, find, create, update, delete |
| SmsTrunkGroup                     | `client.smsTrunkGroups()`                     | list, find, create, update, delete |
| SmsTrunkRegenerateCredential      | `client.smsTrunkRegenerateCredentials()`      | create                             |
| SenderIdVerification              | `client.senderIdVerifications()`              | list, find, update                 |
| DidReservation                    | `client.didReservations()`                    | list, find, create, update, delete |
| CapacityPool                      | `client.capacityPools()`                      | list, find, update                 |
| SharedCapacityGroup               | `client.sharedCapacityGroups()`               | list, find, create, update, delete |
| Order                             | `client.orders()`                             | list, find, create, update, delete |
| Export                            | `client.exports()`                            | list, find, create, update, delete |
| Address                           | `client.addresses()`                          | list, find, create, update, delete |
| AddressVerification               | `client.addressVerifications()`               | list, find, create, update, delete |
| Identity                          | `client.identities()`                         | list, find, create, update, delete |
| EncryptedFile                     | `client.encryptedFiles()`                     | list, find, delete                 |
| PermanentSupportingDocument       | `client.permanentSupportingDocuments()`       | create, delete                     |
| Proof                             | `client.proofs()`                             | create, delete                     |
| AddressRequirementValidation      | `client.addressRequirementValidations()`      | create                             |
| DidHistory                        | `client.didHistory()`                         | list, find                         |
| EmergencyRequirement              | `client.emergencyRequirements()`              | list, find                         |
| EmergencyRequirementValidation    | `client.emergencyRequirementValidations()`    | create                             |
| EmergencyCallingService           | `client.emergencyCallingServices()`           | list, find, delete                 |
| EmergencyVerification             | `client.emergencyVerifications()`             | list, find, create, update         |

"delete" is the `remove(id)` method of a repository. The price rows (`VoiceInPrice`, `VoiceOutPrice`, `SmsOutPrice`, `SmsInPrice`) are served by the prices services outside the JSON:API, through `lookup`, `head`, `download`, `downloadToFile` and `fetch` of the price accessors (see [Prices](#prices)).

## Migrating from 3.x

4.0.0 targets API `2026-10-22` only. To stay on API `2026-04-16`, keep 3.x (`npm install @didww/sdk@^3`, branch [`release-3`](https://github.com/didww/didww-api-3-typescript-sdk/tree/release-3)).

Most code keeps working: `new DidwwClient({ apiKey, environment })` is unchanged, and the SDK mints the access tokens itself. The breaking changes:

- **Authentication.** Every request carries a bearer token minted from the API key (see [Authentication](#authentication)). The `Api-Key` header is sent only to the token service, so outgoing traffic must reach `auth.didww.com` (`auth-sandbox.didww.com` in the sandbox), and the price hosts when you use prices. The token service can reject any call with a `DidwwAuthError`; an API key that is refused now rejects with `DidwwAuthError` of kind `AuthErrorKind.INVALID_CLIENT` instead of a `DidwwApiError` with status 401.
- **API version.** `X-DIDWW-API-Version` is no longer sent: the version is requested in the token. The default is `2026-10-22` (`DEFAULT_API_VERSION`, `client.apiVersion`), and an earlier version makes the constructor throw a `DidwwClientError`.
- **Environment.** `environment` also selects the token service and the price hosts, and is not derived from `baseUrl`: to reach production, pass `environment: Environment.PRODUCTION` (a production `baseUrl` alone mints at the sandbox token service and fails with `DidwwAuthError`).
- **Validation.** The constructor throws a `DidwwClientError` for an invalid API key, API version, scope, timeout, token store, logger, agent or service URL (see [Configuration](#configuration)), which 3.x accepted.
- **Transport.** Requests are no longer sent with `fetch`. The `fetch` option and the `FetchFunction` type are removed; pass an `http.Agent` as `agent` for a proxy or TLS settings (see [Proxy, TLS and connections](#proxy-tls-and-connections)), for example `https-proxy-agent` where 3.x used undici's `ProxyAgent`. A JavaScript caller still passing `fetch` gets a `DidwwClientError`. On Node.js 18 connections are not kept alive unless your agent does so.
- **HTTP defaults.** 3.x had undici's limits (10 s to connect, 300 s for the headers and the body), and `timeout` was a total limit. 4.x opens connections within 10 s and waits up to 60 s for each read (`connectTimeout`, `readTimeout`), with no total limit unless you set `timeout`; a timeout above 2,147,483,647 ms is refused. It follows no redirects, which 3.x did: a 3xx is an error. It stores no cookies.
- **Transport errors.** A connection failure, timeout or TLS error no longer rejects with a raw `TypeError: fetch failed`: the JSON:API, upload and export calls reject with a `DidwwClientError` with the Node.js error as its `cause`, the token service with a `DidwwAuthError` and the prices services with a `DidwwPricesError`. A 2xx answer that is not valid JSON now rejects with a `DidwwClientError` instead of resolving to `{ errors: [{ detail }] }`. An error answer that is not JSON (an HTML page of a proxy, for example) now gives a `DidwwApiError` with `errors: []`, the message `API error <status>` and its text in `body`, where 3.x put the text in `errors[0].detail` and in the message.
- **Removed resources.** `client.pops()` and `client.didGroupTypes()` are removed, with the `DidGroupType` resource type and the `did_group_type` relationship and include; the name `Pop` now belongs to an enum (see the next item). `DidGroup`, `AddressRequirement`, `EmergencyRequirement` and `EmergencyCallingService` have `numberType` instead of `didGroupType`; filter with `number_type` instead of `did_group_type.id`, and with `did_group.number_type` on available DIDs.
- **Point of presence.** `VoiceInTrunk.pop` is a value of the enum `Pop` (for example `Pop.FRA`), an attribute, where 3.x took `ref('pops', id)` and `Pop` was the type of the `pops` resource; it is no longer a relationship and cannot be included.
- **Exact numbers.** A non-canonical number in an answer (`1.10`, an integer above 2^53) is a `JsonNumber` where the SDK keeps the raw value: in the results of the low-level `client.get()`, `client.post()` and `client.patch()` and in the attributes of an unknown SMS trunk configuration. Request bodies write `JsonNumber` and `bigint` exactly, and refuse `NaN` and `Infinity`, which 3.x sent as `null` (see [Numbers](#numbers)).
- **Export download and file upload.** `downloadExport` and `downloadAndDecompressExport` download only from the API origin or the environment origin (a `DidwwClientError` otherwise, without a request), succeed only on a 200 (any other status rejects with a `DidwwApiError` with the status and the parsed errors), write the file exactly as served, check it against its `Content-Length`, and take an optional file path or writable stream as destination (see [Exports](#exports)). `uploadEncryptedFile` reports the errors of the answer in its `DidwwApiError` instead of `Upload failed`, and rejects with a `TypeError` for `data` that is not a `Buffer` or `Uint8Array`.
- **Errors.** `DidwwApiError` and `DidwwClientError` now derive from the new `DidwwError`, which is also the base of the new `DidwwAuthError` and `DidwwPricesError`.
- **Secrets.** `console.log(client)`, `util.inspect(client)` and `JSON.stringify(client)` no longer show the API key, and neither do those of repositories and `Encrypt`, which hold the client.

New in 4.0.0: [SMS trunks](#sms-trunks), [SMS trunk groups](#sms-trunk-groups), [Sender ID verifications](#sender-id-verifications), [DID SMS routing](#sms-routing), `sms_in` and `sms_out` [exports](#exports), [prices](#prices), `DidGroup.isDemo`, `Identity.companyWebsite`, `JsonNumber`, and the `apiVersion`, `scope`, `tokenStore`, `logger`, `connectTimeout`, `readTimeout`, `agent` and service URL options of `DidwwClient`.

## Development

```bash
# Install the dependencies
npm ci

# Run the tests
npm test

# Type-check the SDK, the examples and the type-level tests
npm run typecheck
npm run typecheck:examples
npm run typecheck:tests-types

# Lint and check the formatting
npm run lint
npm run format:check

# Run an example (see examples/README.md)
DIDWW_API_KEY=your_api_key npx tsx examples/balance.ts
```

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/didww/didww-api-3-typescript-sdk

## Releasing

4.x is released from `main`, 3.x patch releases from `release-3`.

1. Check out the release branch and make sure all changes are committed.
2. `npm ci && npm run typecheck && npm run typecheck:examples && npm run typecheck:tests-types && npm run lint && npm run format:check && npm test` ensures all checks pass.
3. `npm version X.Y.Z --no-git-tag-version` sets the version in `package.json` and `package-lock.json` (skip it when the version is already set), then commit it and tag it:
   ```bash
   git commit -am "chore: bump version to X.Y.Z"
   git tag -a vX.Y.Z -m "Release version X.Y.Z"
   ```
4. `npm run build` builds the package (`dist/` is not committed; publishing without a build ships stale files).
5. Publish:
   - 4.x: `npm publish --access public`
   - 3.x patch: `npm publish --access public --tag release-3`, so that the `latest` tag stays on 4.x
6. `git push origin main --follow-tags` (or `release-3`) pushes the commit and the tag to GitHub.

**Note**: if `npm publish` fails with error like 404 `'@didww/sdk@2.0.0' is not in this registry.` you need to refresh credentials via `npm login`.

## License

MIT
