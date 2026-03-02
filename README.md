# @didww/sdk

TypeScript SDK for the DIDWW API v3.

## About DIDWW API v3

The DIDWW API provides a simple yet powerful interface that allows you to fully integrate your own applications with DIDWW services. An extensive set of actions may be performed using this API, such as ordering and configuring phone numbers, setting capacity, creating SIP trunks and retrieving CDRs and other operational data.

The DIDWW API v3 is a fully compliant implementation of the [JSON API specification](http://jsonapi.org/format/).

Read more https://doc.didww.com/api

This SDK sends the `X-DIDWW-API-Version: 2022-05-10` header with every request.

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
client.requirements();
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
  capacityLimit: '5',
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

```typescript
import { DefaultDstAction, OnCliMismatchAction } from '@didww/sdk';

const voTrunk = await client.voiceOutTrunks().create({
  name: 'My Outbound Trunk',
  allowedSipIps: ['0.0.0.0/0'],
  defaultDstAction: DefaultDstAction.ALLOW_ALL,
  onCliMismatchAction: OnCliMismatchAction.REJECT_CALL,
});
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
  filters: { year: 2025, month: 1 },
});

// Download when completed
const data = await client.downloadExport(exp.data.url);
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
  OnCliMismatchAction, // SEND_ORIGINAL_CLI, REJECT_CALL, REPLACE_CLI*, RANDOMIZE_CLI*
  MediaEncryptionMode, // DISABLED, SRTP_SDES, SRTP_DTLS, ZRTP
  DefaultDstAction, // ALLOW_ALL, REJECT_ALL
  VoiceOutTrunkStatus, // ACTIVE, BLOCKED
  CliFormat, // RAW, E164, LOCAL
  AreaLevel, // WORLDWIDE, COUNTRY, AREA, CITY
  Feature, // VOICE, VOICE_IN, VOICE_OUT, T38, SMS, SMS_IN, SMS_OUT
  StirShakenMode, // DISABLED, ORIGINAL, PAI, ORIGINAL_PAI, VERSTAT
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
| Requirement                       | `client.requirements()`                       | list, find                         |
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
| AddressVerification               | `client.addressVerifications()`               | list, find, create, delete         |
| Identity                          | `client.identities()`                         | list, find, create, update, delete |
| EncryptedFile                     | `client.encryptedFiles()`                     | list, find, delete                 |
| PermanentSupportingDocument       | `client.permanentSupportingDocuments()`       | create, delete                     |
| Proof                             | `client.proofs()`                             | create, delete                     |
| RequirementValidation             | `client.requirementValidations()`             | create                             |

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/didww/didww-api-3-typescript-sdk

## Releasing

1. Make sure you're on the `main` branch
2. `npm version X.Y.Z` — updates `package.json`, `package-lock.json`, commits, and creates tag `vX.Y.Z`
3. `git push --follow-tags` — pushes the commit and tag, triggering the release workflow

`npm version` also accepts semver keywords: `patch`, `minor`, `major`.

The release workflow will automatically run CI checks and publish to npm.

## License

MIT
