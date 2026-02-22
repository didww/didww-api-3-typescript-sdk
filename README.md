# @didww/sdk

TypeScript SDK for the DIDWW API v3.

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

## Resources

### Read-Only Resources

```typescript
client.countries().list(params?)
client.countries().find(id, params?)
client.regions()
client.cities()
client.areas()
client.pops()
client.didGroupTypes()
client.didGroups()
client.availableDids()
client.nanpaPrefixes()
client.proofTypes()
client.publicKeys()
client.requirements()
client.supportingDocumentTemplates()
client.stockKeepingUnits()
client.qtyBasedPricings()
```

### Singleton Resources

```typescript
const balance = await client.balance().find();
```

### CRUD Resources

```typescript
// Voice In Trunks
import { sipConfiguration, ref, Codec, TransportProtocol } from '@didww/sdk';

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

await client.voiceInTrunks().update({
  id: trunk.data.id,
  name: 'Updated Name',
});

await client.voiceInTrunks().remove(trunk.data.id);
```

### Orders

```typescript
import { didOrderItem, capacityOrderItem } from '@didww/sdk';

const order = await client.orders().create({
  allow_back_ordering: true,
  items: [
    didOrderItem({ sku_id: 'sku-id', qty: 2 }),
    capacityOrderItem({ capacity_pool_id: 'pool-id', qty: 1 }),
  ],
});
```

### DID Management

```typescript
import { assignVoiceInTrunk } from '@didww/sdk';

// Assign a trunk to a DID (automatically nullifies trunk group)
await client.dids().update(assignVoiceInTrunk('did-id', 'trunk-id'));
```

## Query Parameters

```typescript
const result = await client.didGroups().list({
  filter: { country_id: 'country-uuid' },
  include: ['country', 'stock_keeping_units'],
  sort: '-prefix',
  page: { number: 1, size: 25 },
});
```

## Trunk Configurations

Four configuration types are supported:

```typescript
import {
  sipConfiguration,
  h323Configuration,
  iax2Configuration,
  pstnConfiguration,
  Codec,
  TransportProtocol,
  MediaEncryptionMode,
} from '@didww/sdk';

const sip = sipConfiguration({
  host: 'sip.example.com',
  port: 5060,
  codec_ids: [Codec.PCMU, Codec.PCMA],
  transport_protocol_id: TransportProtocol.UDP,
  media_encryption_mode: MediaEncryptionMode.DISABLED,
});
const h323 = h323Configuration({ dst: '1234', host: 'h323.example.com', port: 1720, codec_ids: [Codec.PCMU] });
const iax2 = iax2Configuration({ dst: '1234', host: 'iax.example.com', port: 4569, codec_ids: [Codec.PCMU] });
const pstn = pstnConfiguration({ dst: '1234567890' });
```

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
import { encryptWithKeys, calculateFingerprint, ref } from '@didww/sdk';
import { readFileSync } from 'node:fs';

// Get public keys
const keys = await client.publicKeys().list();
const pems: [string, string] = [keys.data[0].key, keys.data[1].key];

// Encrypt and upload
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

## Webhook Validation

```typescript
import { RequestValidator } from '@didww/sdk';

const validator = new RequestValidator('your-api-key');
const isValid = validator.validate(url, payload, signature);
```

## Error Handling

```typescript
import { DidwwApiError } from '@didww/sdk';

try {
  await client.orders().create({ /* ... */ });
} catch (error) {
  if (error instanceof DidwwApiError) {
    console.log('Status:', error.status);
    console.log('Errors:', error.errors);
  }
}
```

## Available Repository Methods

| Resource | list | find | create | update | delete |
|----------|------|------|--------|--------|--------|
| Country, Region, City, Area, Pop, etc. | ✓ | ✓ | - | - | - |
| CapacityPool | ✓ | ✓ | - | ✓ | - |
| Balance | - | ✓ | - | - | - |
| VoiceInTrunk, VoiceOutTrunk | ✓ | ✓ | ✓ | ✓ | ✓ |
| VoiceInTrunkGroup, SharedCapacityGroup | ✓ | ✓ | ✓ | ✓ | ✓ |
| Did | ✓ | ✓ | - | ✓ | ✓ |
| Order, Export | ✓ | ✓ | ✓ | ✓ | ✓ |
| DidReservation, Address, Identity | ✓ | ✓ | ✓ | ✓ | ✓ |
| AddressVerification, Proof, etc. | ✓ | ✓ | ✓ | - | ✓ |

## License

MIT
