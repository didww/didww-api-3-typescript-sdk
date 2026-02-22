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
import { sipConfiguration, ref } from '@didww/sdk';

const trunk = await client.voiceInTrunks().create({
  name: 'My SIP Trunk',
  configuration: sipConfiguration({
    host: 'sip.example.com',
    port: 5060,
    codec_ids: [9, 10],
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
} from '@didww/sdk';

const sip = sipConfiguration({ host: 'sip.example.com', port: 5060, codec_ids: [9, 10] });
const h323 = h323Configuration({ dst: '1234', host: 'h323.example.com', port: 1720, codec_ids: [9] });
const iax2 = iax2Configuration({ dst: '1234', host: 'iax.example.com', port: 4569, codec_ids: [9] });
const pstn = pstnConfiguration({ dst: '1234567890' });
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
