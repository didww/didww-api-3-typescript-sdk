# @didww/sdk

TypeScript SDK for the DIDWW API v3.

![Tests](https://github.com/didww/didww-api-3-typescript-sdk/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/endpoint?url=https://didww.github.io/didww-api-3-typescript-sdk/badge.json)
![Node](https://img.shields.io/badge/node-18%2B-blue)

## About DIDWW API v3

The DIDWW API provides a simple yet powerful interface that allows you to fully integrate your own applications with DIDWW services. An extensive set of actions may be performed using this API, such as ordering and configuring phone numbers, setting capacity, creating SIP trunks and retrieving CDRs and other operational data.

The DIDWW API v3 is a fully compliant implementation of the [JSON API specification](http://jsonapi.org/format/).

This SDK uses [kitsu-core](https://github.com/wopian/kitsu/tree/master/packages/kitsu-core) for JSON:API serialization and deserialization.

Read more https://doc.didww.com/api

This SDK sends the `X-DIDWW-API-Version: 2026-04-16` header with every request.

NPM Versions **3.X.X** are intended to use with DIDWW API 3 version [2026-04-16](https://doc.didww.com/api3/2026-04-16/index.html).

NPM Versions **2.X.X** and branch [release-2](https://github.com/didww/didww-api-3-typescript-sdk/tree/release-2) are intended to use with DIDWW API 3 version [2022-05-10](https://doc.didww.com/api3/2022-05-10/index.html).

## Installation

```bash
npm install @didww/sdk
```

Requires Node.js 18+.

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

For more examples visit [examples](examples/).

For details on obtaining your API key please visit https://doc.didww.com/api3/configuration.html

## Examples

- Source code: [examples/](examples/)
- How to run: [examples/README.md](examples/README.md)

## Configuration

```typescript
const client = new DidwwClient({
  apiKey: 'your-api-key',
  environment: Environment.PRODUCTION,
  timeout: 30_000, // 30 seconds
});
```

### Environments

| Environment              | Base URL                           |
| ------------------------ | ---------------------------------- |
| `Environment.PRODUCTION` | `https://api.didww.com/v3`         |
| `Environment.SANDBOX`    | `https://sandbox-api.didww.com/v3` |

### HTTPS Proxy

You can pass a custom `fetch` function to route requests through an HTTPS proxy.

> **Note:** [undici](https://github.com/nodejs/undici) must be installed separately: `npm install undici`

```typescript
import { DidwwClient, Environment } from '@didww/sdk';
import { ProxyAgent } from 'undici';

const proxyAgent = new ProxyAgent('https://proxy.example.com:8080');

const client = new DidwwClient({
  apiKey: 'your-api-key',
  environment: Environment.PRODUCTION,
  fetch: (input, init) => fetch(input, { ...init, dispatcher: proxyAgent } as RequestInit),
});
```

## Resources

### Read-Only Resources

```typescript
// Countries
const countries = await client.countries().list();
const country = await client.countries().find('uuid');

// Regions
const regions = await client.regions().list();

// Cities, Areas, POPs
const cities = await client.cities().list();
const areas = await client.areas().list();
const pops = await client.pops().list();

// DID Groups (with stock keeping units)
const groups = await client.didGroups().list({
  include: 'stock_keeping_units',
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
const skus = didGroup?.stockKeepingUnits; // resolved StockKeepingUnit[]
console.log(ad.number, didGroup?.prefix, skus?.[0]?.monthlyPrice);

// Other read-only resources
client.didGroupTypes();
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

### Voice In Trunks

```typescript
import { sipConfiguration, pstnConfiguration, ref, Codec, TransportProtocol } from '@didww/sdk';

// Create SIP trunk
const trunk = await client.voiceInTrunks().create({
  name: 'My SIP Trunk',
  configuration: sipConfiguration({
    host: 'sip.example.com',
    port: 5060,
    codecIds: [Codec.PCMU, Codec.PCMA],
    transportProtocolId: TransportProtocol.UDP,
  }),
  pop: ref('pops', 'pop-id'),
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
import { DefaultDstAction, OnCliMismatchAction, credentialsAndIpAuthenticationMethod } from '@didww/sdk';

// NOTE: 203.0.113.0/24 is RFC 5737 TEST-NET-3 documentation space.
// Replace with the real CIDR of your SIP infrastructure.
const voTrunk = await client.voiceOutTrunks().create({
  name: 'My Outbound Trunk',
  authenticationMethod: credentialsAndIpAuthenticationMethod({
    allowedSipIps: ['203.0.113.0/24'],
    techPrefix: '',
  }),
  defaultDstAction: DefaultDstAction.ALLOW_ALL,
  onCliMismatchAction: OnCliMismatchAction.REJECT_CALL,
});
// voTrunk.data.authenticationMethod.username -- server-generated
// voTrunk.data.authenticationMethod.password -- server-generated
```

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
import { ExportType } from '@didww/sdk';

const exp = await client.exports().create({
  exportType: ExportType.CDR_IN,
  filters: {
    from: '2026-04-15 00:00:00', // inclusive (time_start >= from)
    to: '2026-04-16 00:00:00',   // exclusive (time_start < to)
  },
});

// Download when completed
const data = await client.downloadExport(exp.data.url);
```

### Address Verifications

```typescript
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

## Included Resources

Use the `include` parameter to sideload related resources. Included relationships are resolved directly on the parent object:

```typescript
// Regions with their country
const regions = await client.regions().list({
  include: 'country',
});
for (const region of regions.data) {
  console.log(region.name, region.country?.name);
}

// DID groups with nested stock keeping units
const groups = await client.didGroups().list({
  include: 'stock_keeping_units',
});
for (const group of groups.data) {
  for (const sku of group.stockKeepingUnits || []) {
    console.log(group.prefix, sku.monthlyPrice);
  }
}

// Available DIDs with nested includes (did_group → stock_keeping_units)
const available = await client.availableDids().list({
  include: 'did_group.stock_keeping_units',
});
const ad = available.data[0];
const skuId = ad.didGroup?.stockKeepingUnits?.[0]?.id;

// DIDs with voice trunk and capacity pool
const dids = await client.dids().list({
  include: 'voice_in_trunk,capacity_pool',
});
for (const did of dids.data) {
  console.log(did.number, did.voiceInTrunk?.name, did.capacityPool?.name);
}
```

## Query Parameters

```typescript
const result = await client.regions().list({
  filter: { 'country.id': 'uuid', name: 'Arizona' },
  include: ['country'],
  sort: '-name',
  page: { number: 1, size: 25 },
});
```

## Dirty Tracking (PATCH Optimization)

When you fetch a resource from the API, the SDK snapshots its writable attributes. On update, only changed fields are sent in the PATCH request:

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
const response = await client.dids().find('did-id', { include: 'voice_in_trunk' });
const trunk = response.data.voiceInTrunk;

// trunk has a clean snapshot — only dirty fields are sent
trunk.name = 'Renamed trunk';

// PATCH request body (JSON:API format):
// {
//   "data": {
//     "id": "<trunk-id>",
//     "type": "voice_in_trunks",
//     "attributes": { "name": "Renamed trunk" }
//   }
// }
await client.voiceInTrunks().update(trunk);
```

Setting a field to `null` explicitly clears it:

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

## Order Item Types

| Type            | Factory                                                |
| --------------- | ------------------------------------------------------ |
| DID (by SKU)    | `didOrderItem({ skuId, qty })`                         |
| Available DID   | `availableDidOrderItem({ skuId, availableDidId })`     |
| Reservation DID | `reservationDidOrderItem({ skuId, didReservationId })` |
| Capacity        | `capacityOrderItem({ capacityPoolId, qty })`           |
| Emergency       | `emergencyOrderItem({ emergencyCallingServiceId, qty })` |

## Date and Datetime Fields

All date and datetime fields are returned as ISO 8601 strings. JavaScript's `Date` object has known pitfalls (mutable, timezone handling, 0-indexed months), so the SDK intentionally keeps these as `string` and lets you parse them with the library of your choice.

- **Datetime fields** — ISO 8601 strings e.g. `"2024-01-15T10:00:00.000Z"`:
  - `createdAt` — present on most resources
  - `expiresAt` — `Did`, `DidReservation`, `Proof`, `EncryptedFile` (nullable)
  - `activatedAt` — `EmergencyCallingService` (nullable)
  - `canceledAt` — `EmergencyCallingService` (nullable)
- **Date-only fields** — date strings e.g. `"1990-05-20"`:
  - `Identity.birthDate`
  - `CapacityPool.renewDate`, `EmergencyCallingService.renewDate` (nullable)
  - `DidOrderItem.billedFrom`, `DidOrderItem.billedTo`
- **String fields** (not numeric):
  - `EmergencyRequirement.estimateSetupTime` — e.g. `"7-14 days"`, `"1"`
  - `EmergencyRequirement.requirementRestrictionMessage` — nullable

**Important changes from previous API versions:**
- `expireAt` renamed to `expiresAt` on `DidReservation` and `EncryptedFile`
- `renewDate` is a date-only string, NOT a datetime
- `estimateSetupTime` is a string, NOT a number

```typescript
const did = await client.dids().find('uuid');
console.log(did.createdAt);   // "2024-01-15T10:00:00.000Z"
console.log(did.expiresAt);   // null or "2025-01-15T10:00:00.000Z"

// Parse with your preferred library:
import { parseISO } from 'date-fns';
const date = parseISO(did.createdAt);
```

## Enums

Type-safe enums are provided for all API constant fields:

```typescript
import {
  // String enums
  CallbackMethod, // POST, GET
  AddressVerificationStatus, // PENDING, APPROVED, REJECTED
  ExportType, // CDR_IN, CDR_OUT
  ExportStatus, // PENDING, PROCESSING, COMPLETED
  IdentityType, // PERSONAL, BUSINESS, ANY
  OrderStatus, // PENDING, CANCELED, COMPLETED
  OnCliMismatchAction, // SEND_ORIGINAL_CLI, REJECT_CALL, REPLACE_CLI*, RANDOMIZE_CLI* (requires account config)
  MediaEncryptionMode, // DISABLED, SRTP_SDES, SRTP_DTLS, ZRTP
  DefaultDstAction, // ALLOW_ALL, REJECT_ALL
  VoiceOutTrunkStatus, // ACTIVE, BLOCKED
  CliFormat, // RAW, E164, LOCAL
  AreaLevel, // WORLDWIDE, COUNTRY, AREA, CITY
  Feature, // VOICE, VOICE_IN, VOICE_OUT, T38, SMS, SMS_IN, SMS_OUT, P2P, A2P, EMERGENCY, CNAM_OUT
  StirShakenMode, // DISABLED, ORIGINAL, PAI, ORIGINAL_PAI, VERSTAT
  EmergencyCallingServiceStatus, // ACTIVE, CANCELED, CHANGES_REQUIRED, IN_PROCESS, NEW, PENDING_UPDATE
  EmergencyVerificationStatus, // PENDING, APPROVED, REJECTED
  DiversionRelayPolicy, // NONE, AS_IS, SIP, TEL
  // Integer enums
  TransportProtocol, // UDP=1, TCP=2, TLS=3
  RxDtmfFormat, // RFC_2833=1, SIP_INFO=2, RFC_2833_OR_SIP_INFO=3
  TxDtmfFormat, // DISABLED=1, RFC_2833=2, SIP_INFO_RELAY=3, SIP_INFO_DTMF=4
  SstRefreshMethod, // INVITE=1, UPDATE=2, UPDATE_FALLBACK_INVITE=3
  Codec, // TELEPHONE_EVENT=6, G723=7, G729=8, PCMU=9, PCMA=10, ...
} from '@didww/sdk';
```

## File Encryption & Upload

```typescript
import { Encrypt } from '@didww/sdk';

// Instance-based: fetches public keys from the API automatically
const enc = new Encrypt(client);
const fingerprint = await enc.getFingerprint();
const encrypted = await enc.encrypt(fileBuffer);

const ids = await client.uploadEncryptedFiles(fingerprint, [
  { data: encrypted, description: 'My document', filename: 'document.pdf.enc' },
]);
```

Static functions are also available for manual key management:

```typescript
import { encryptWithKeys, calculateFingerprint, ref } from '@didww/sdk';
import { readFileSync } from 'node:fs';

const keys = await client.publicKeys().list();
const pems: [string, string] = [keys.data[0].key, keys.data[1].key];

const fingerprint = calculateFingerprint(pems);
const encrypted = encryptWithKeys(readFileSync('document.pdf'), pems);
const ids = await client.uploadEncryptedFiles(fingerprint, [
  { data: encrypted, description: 'My document', filename: 'document.pdf.enc' },
]);

// Create proof with uploaded files
await client.proofs().create({
  proofType: ref('proof_types', 'type-id'),
  entity: ref('identities', 'identity-id'),
  files: ids.map((id) => ref('encrypted_files', id)),
});
```

## Webhook Signature Validation

Validate incoming webhook callbacks from DIDWW using HMAC-SHA1 signature verification.

```typescript
import { RequestValidator } from '@didww/sdk';

const validator = new RequestValidator('your-api-key');

// In your webhook handler:
const valid = validator.validate(
  requestUrl, // full original URL
  payload, // Record<string, string> of payload key-value pairs
  signature, // value of X-DIDWW-Signature header
);
```

## Error Handling

```typescript
import { DidwwApiError } from '@didww/sdk';

try {
  await client.orders().create({
    /* ... */
  });
} catch (error) {
  if (error instanceof DidwwApiError) {
    console.log('Status:', error.status);
    for (const err of error.errors) {
      console.log(`Error: ${err.detail} (code: ${err.code})`);
    }
  }
}
```

## All Supported Resources

| Resource                          | Repository                                    | Operations                         |
| --------------------------------- | --------------------------------------------- | ---------------------------------- |
| Country                           | `client.countries()`                          | list, find                         |
| Region                            | `client.regions()`                            | list, find                         |
| City                              | `client.cities()`                             | list, find                         |
| Area                              | `client.areas()`                              | list, find                         |
| NanpaPrefix                       | `client.nanpaPrefixes()`                      | list, find                         |
| Pop                               | `client.pops()`                               | list, find                         |
| DidGroupType                      | `client.didGroupTypes()`                      | list, find                         |
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

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/didww/didww-api-3-typescript-sdk

## Releasing

1. Ensure you are on the `main` branch and have committed all changes.
2. `npm ci && npm run typecheck && npm run lint && npm run format:check` ensure all checks pass
3. `npm version X.Y.Z` (creates git commit and tag)
4. `npm run build` build package
5. `npm publish --access public` releases npm package
6. `git push --follow-tags origin main` pushes git commit and tag to GitHub

**Note**: if `npm publish` fails with error like 404 `'@didww/sdk@2.0.0' is not in this registry.` you need to refresh credentials via `npm login`.

## License

MIT
