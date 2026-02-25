# @didww/sdk

TypeScript SDK for the DIDWW API v3.

## About DIDWW API v3

The DIDWW API provides a simple yet powerful interface that allows you to fully integrate your own applications with DIDWW services. An extensive set of actions may be performed using this API, such as ordering and configuring phone numbers, setting capacity, creating SIP trunks and retrieving CDRs and other operational data.

The DIDWW API v3 is a fully compliant implementation of the [JSON API specification](http://jsonapi.org/format/).

Read more https://doc.didww.com/api

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
console.log(balance.data.total_balance);

// List countries
const countries = await client.countries().list();
for (const country of countries.data) {
  console.log(`${country.iso} - ${country.name}`);
}
```

For more examples visit [examples](examples/).

For details on obtaining your API key please visit https://doc.didww.com/api#introduction-api-keys

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

| Environment | Base URL |
|-------------|----------|
| `Environment.PRODUCTION` | `https://api.didww.com/v3` |
| `Environment.SANDBOX` | `https://sandbox-api.didww.com/v3` |

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

// Available DIDs (with DID group and stock keeping units)
const available = await client.availableDids().list({
  include: 'did_group.stock_keeping_units',
});

// Other read-only resources
client.didGroupTypes()
client.nanpaPrefixes()
client.proofTypes()
client.publicKeys()
client.requirements()
client.supportingDocumentTemplates()
client.stockKeepingUnits()
client.qtyBasedPricings()

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
  voice_in_trunk: ref('voice_in_trunks', 'trunk-id'),
});

// Assign capacity pool and update attributes in one call
await client.dids().update({
  id: 'did-id',
  capacity_pool: ref('capacity_pools', 'pool-id'),
  dedicated_channels_count: 1,
  capacity_limit: '5',
  description: 'Updated',
});

// Unassign a trunk (set to null)
await client.dids().update({
  id: 'did-id',
  voice_in_trunk: null,
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
    codec_ids: [Codec.PCMU, Codec.PCMA],
    transport_protocol_id: TransportProtocol.UDP,
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
  capacity_limit: 50,
});
```

### Voice Out Trunks

```typescript
const voTrunk = await client.voiceOutTrunks().create({
  name: 'My Outbound Trunk',
  allowed_sip_ips: ['0.0.0.0/0'],
  default_dst_action: 'allow_all',
  on_cli_mismatch_action: 'replace_cli',
});
```

### Orders

```typescript
import {
  didOrderItem,
  availableDidOrderItem,
  reservationDidOrderItem,
  capacityOrderItem,
} from '@didww/sdk';

// Order by SKU
const order = await client.orders().create({
  allow_back_ordering: true,
  items: [
    didOrderItem({ sku_id: 'sku-id', qty: 2 }),
  ],
});

// Order a specific available DID
const order2 = await client.orders().create({
  items: [
    availableDidOrderItem({ sku_id: 'sku-id', available_did_id: 'available-did-id' }),
  ],
});

// Order a reserved DID
const order3 = await client.orders().create({
  items: [
    reservationDidOrderItem({ sku_id: 'sku-id', did_reservation_id: 'reservation-id' }),
  ],
});

// Order capacity
const order4 = await client.orders().create({
  items: [
    capacityOrderItem({ capacity_pool_id: 'pool-id', qty: 1 }),
  ],
});
```

### DID Reservations

```typescript
const reservation = await client.didReservations().create({
  description: 'Reserved for client',
  available_did: ref('available_dids', 'available-did-id'),
});

await client.didReservations().remove(reservation.data.id);
```

### Shared Capacity Groups

```typescript
const scg = await client.sharedCapacityGroups().create({
  name: 'Shared Group',
  shared_channels_count: 20,
  capacity_pool: ref('capacity_pools', 'pool-id'),
});
```

### Identities

```typescript
import { IdentityType, ref } from '@didww/sdk';

const identity = await client.identities().create({
  identity_type: IdentityType.PERSONAL,
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '12125551234',
  country: ref('countries', 'country-id'),
});
```

### Addresses

```typescript
const address = await client.addresses().create({
  city_name: 'New York',
  postal_code: '10001',
  address: '123 Main St',
  identity: ref('identities', 'identity-id'),
  country: ref('countries', 'country-id'),
});
```

### Exports

```typescript
const exp = await client.exports().create({
  export_type: 'cdr_in',
  filters: { year: 2025, month: 1 },
});

// Download when completed
const data = await client.downloadExport(exp.data.url);
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

| Type | Factory |
|------|---------|
| SIP | `sipConfiguration({ host, port, codec_ids, ... })` |
| PSTN | `pstnConfiguration({ dst })` |

## Order Item Types

| Type | Factory |
|------|---------|
| DID (by SKU) | `didOrderItem({ sku_id, qty })` |
| Available DID | `availableDidOrderItem({ sku_id, available_did_id })` |
| Reservation DID | `reservationDidOrderItem({ sku_id, did_reservation_id })` |
| Capacity | `capacityOrderItem({ capacity_pool_id, qty })` |

## Enums

Type-safe enums are provided for all API constant fields:

```typescript
import {
  // String enums
  CallbackMethod,          // POST, GET
  AddressVerificationStatus, // PENDING, APPROVED, REJECTED
  ExportType,              // CDR_IN, CDR_OUT
  ExportStatus,            // PENDING, PROCESSING, COMPLETED
  IdentityType,            // PERSONAL, BUSINESS, ANY
  OrderStatus,             // PENDING, CANCELED, COMPLETED
  OnCliMismatchAction,     // SEND_ORIGINAL_CLI, REJECT_CALL, REPLACE_CLI
  MediaEncryptionMode,     // DISABLED, SRTP_SDES, SRTP_DTLS, ZRTP
  DefaultDstAction,        // ALLOW_ALL, REJECT_ALL
  VoiceOutTrunkStatus,     // ACTIVE, BLOCKED
  CliFormat,               // RAW, E164, LOCAL
  AreaLevel,               // WORLDWIDE, COUNTRY, AREA, CITY
  Feature,                 // VOICE, VOICE_IN, VOICE_OUT, T38, SMS, SMS_IN, SMS_OUT
  StirShakenMode,          // DISABLED, ORIGINAL, PAI, ORIGINAL_PAI, VERSTAT
  // Integer enums
  TransportProtocol,       // UDP=1, TCP=2, TLS=3
  RxDtmfFormat,            // RFC_2833=1, SIP_INFO=2, RFC_2833_OR_SIP_INFO=3
  TxDtmfFormat,            // DISABLED=1, RFC_2833=2, SIP_INFO_RELAY=3, SIP_INFO_DTMF=4
  SstRefreshMethod,        // INVITE=1, UPDATE=2, UPDATE_FALLBACK_INVITE=3
  Codec,                   // TELEPHONE_EVENT=6, G723=7, G729=8, PCMU=9, PCMA=10, ...
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
  proof_type: ref('proof_types', 'type-id'),
  entity: ref('identities', 'identity-id'),
  files: ids.map(id => ref('encrypted_files', id)),
});
```

## Webhook Signature Validation

Validate incoming webhook callbacks from DIDWW using HMAC-SHA1 signature verification.

```typescript
import { RequestValidator } from '@didww/sdk';

const validator = new RequestValidator('your-api-key');

// In your webhook handler:
const valid = validator.validate(
  requestUrl,    // full original URL
  payload,       // Record<string, string> of payload key-value pairs
  signature,     // value of X-DIDWW-Signature header
);
```

## Error Handling

```typescript
import { DidwwApiError } from '@didww/sdk';

try {
  await client.orders().create({ /* ... */ });
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

| Resource | Repository | Operations |
|----------|-----------|------------|
| Country | `client.countries()` | list, find |
| Region | `client.regions()` | list, find |
| City | `client.cities()` | list, find |
| Area | `client.areas()` | list, find |
| NanpaPrefix | `client.nanpaPrefixes()` | list, find |
| Pop | `client.pops()` | list, find |
| DidGroupType | `client.didGroupTypes()` | list, find |
| DidGroup | `client.didGroups()` | list, find |
| AvailableDid | `client.availableDids()` | list, find |
| ProofType | `client.proofTypes()` | list, find |
| PublicKey | `client.publicKeys()` | list, find |
| Requirement | `client.requirements()` | list, find |
| SupportingDocumentTemplate | `client.supportingDocumentTemplates()` | list, find |
| StockKeepingUnit | `client.stockKeepingUnits()` | list, find |
| QtyBasedPricing | `client.qtyBasedPricings()` | list, find |
| Balance | `client.balance()` | find |
| Did | `client.dids()` | list, find, update, delete |
| VoiceInTrunk | `client.voiceInTrunks()` | list, find, create, update, delete |
| VoiceInTrunkGroup | `client.voiceInTrunkGroups()` | list, find, create, update, delete |
| VoiceOutTrunk | `client.voiceOutTrunks()` | list, find, create, update, delete |
| VoiceOutTrunkRegenerateCredential | `client.voiceOutTrunkRegenerateCredentials()` | create |
| DidReservation | `client.didReservations()` | list, find, create, update, delete |
| CapacityPool | `client.capacityPools()` | list, find, update |
| SharedCapacityGroup | `client.sharedCapacityGroups()` | list, find, create, update, delete |
| Order | `client.orders()` | list, find, create, update, delete |
| Export | `client.exports()` | list, find, create, update, delete |
| Address | `client.addresses()` | list, find, create, update, delete |
| AddressVerification | `client.addressVerifications()` | list, find, create, delete |
| Identity | `client.identities()` | list, find, create, update, delete |
| EncryptedFile | `client.encryptedFiles()` | list, find, delete |
| PermanentSupportingDocument | `client.permanentSupportingDocuments()` | create, delete |
| Proof | `client.proofs()` | create, delete |
| RequirementValidation | `client.requirementValidations()` | create |

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/didww/didww-api-3-typescript-sdk

## License

MIT
