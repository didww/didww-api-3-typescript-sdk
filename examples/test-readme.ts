/**
 * Tests all README examples against the sandbox API.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/test-readme.ts
 */
import {
  DidwwClient,
  Environment,
  DidwwApiError,
  ref,
  isIncluded,
  sipConfiguration,
  pstnConfiguration,
  didOrderItem,
  availableDidOrderItem,
  capacityOrderItem,
  Codec,
  TransportProtocol,
  DefaultDstAction,
  OnCliMismatchAction,
  ExportType,
  IdentityType,
  Encrypt,
  calculateFingerprint,
  encryptWithKeys,
  RequestValidator,
} from '../src/index.js';

const API_KEY = process.env.DIDWW_API_KEY!;
const client = new DidwwClient({ apiKey: API_KEY, environment: Environment.SANDBOX });

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ─── Quick Start ───────────────────────────────────────────

console.log('\n== Quick Start ==');

await test('Check balance', async () => {
  const balance = await client.balance().find();
  assert(typeof balance.data.totalBalance === 'string', 'totalBalance should be a string');
  console.log(`    balance: ${balance.data.totalBalance}`);
});

await test('List countries', async () => {
  const countries = await client.countries().list({ page: { size: 5 } });
  assert(countries.data.length > 0, 'should have countries');
  for (const country of countries.data) {
    console.log(`    ${country.iso} - ${country.name}`);
  }
});

// ─── Read-Only Resources ───────────────────────────────────

console.log('\n== Read-Only Resources ==');

await test('List regions', async () => {
  const regions = await client.regions().list({ page: { size: 3 } });
  assert(regions.data.length > 0, 'should have regions');
  console.log(`    got ${regions.data.length} regions`);
});

await test('Find single country', async () => {
  const countries = await client.countries().list({ page: { size: 1 } });
  const country = await client.countries().find(countries.data[0].id);
  assert(country.data.id === countries.data[0].id, 'should match');
  console.log(`    found: ${country.data.name}`);
});

await test('List cities', async () => {
  const cities = await client.cities().list({ page: { size: 3 } });
  assert(Array.isArray(cities.data), 'should be array');
  console.log(`    got ${cities.data.length} cities`);
});

await test('List areas', async () => {
  const areas = await client.areas().list({ page: { size: 3 } });
  assert(Array.isArray(areas.data), 'should be array');
  console.log(`    got ${areas.data.length} areas`);
});

await test('List POPs', async () => {
  const pops = await client.pops().list();
  assert(pops.data.length > 0, 'should have POPs');
  console.log(`    got ${pops.data.length} POPs`);
});

await test('DID Groups with stock_keeping_units include', async () => {
  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 3 },
  });
  assert(groups.data.length > 0, 'should have DID groups');
  for (const group of groups.data) {
    const skus = group.stockKeepingUnits;
    console.log(`    ${group.prefix}, ${skus?.length ?? 0} SKUs`);
  }
});

await test('Available DIDs with nested includes', async () => {
  const available = await client.availableDids().list({
    include: 'did_group.stock_keeping_units',
    page: { size: 3 },
  });
  if (available.data.length > 0) {
    const ad = available.data[0];
    const didGroup = ad.didGroup;
    if (didGroup && isIncluded(didGroup)) {
      const skus = didGroup.stockKeepingUnits;
      console.log(`    ${ad.number} group=${didGroup.prefix} skus=${skus?.length ?? 0}`);
    } else {
      console.log(`    ${ad.number} (didGroup not included)`);
    }
  } else {
    console.log('    no available DIDs found');
  }
});

await test('List DID group types', async () => {
  const types = await client.didGroupTypes().list();
  assert(types.data.length > 0, 'should have types');
  console.log(`    got ${types.data.length} types`);
});

await test('List NANPA prefixes', async () => {
  const prefixes = await client.nanpaPrefixes().list({ page: { size: 3 } });
  assert(Array.isArray(prefixes.data), 'should be array');
  console.log(`    got ${prefixes.data.length} prefixes`);
});

await test('List proof types', async () => {
  const proofTypes = await client.proofTypes().list();
  assert(proofTypes.data.length > 0, 'should have proof types');
  console.log(`    got ${proofTypes.data.length} proof types`);
});

await test('List public keys', async () => {
  const keys = await client.publicKeys().list();
  assert(keys.data.length > 0, 'should have public keys');
  console.log(`    got ${keys.data.length} public keys`);
});

await test('List requirements', async () => {
  const requirements = await client.requirements().list({ page: { size: 3 } });
  assert(Array.isArray(requirements.data), 'should be array');
  console.log(`    got ${requirements.data.length} requirements`);
});

await test('List supporting document templates', async () => {
  const templates = await client.supportingDocumentTemplates().list();
  assert(Array.isArray(templates.data), 'should be array');
  console.log(`    got ${templates.data.length} templates`);
});

await test('Stock keeping units (via did_groups include)', async () => {
  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 1 },
  });
  assert(groups.data.length > 0, 'should have DID groups');
  const skus = groups.data[0].stockKeepingUnits || [];
  assert(skus.length > 0, 'should have SKUs included');
  for (const sku of skus) {
    if (isIncluded(sku)) {
      console.log(`    SKU ${sku.id}: $${sku.monthlyPrice}/mo, ${sku.channelsIncludedCount} channels`);
    }
  }
});

await test('Qty based pricings (via capacity_pools include)', async () => {
  const pools = await client.capacityPools().list({
    include: 'qty_based_pricings',
    page: { size: 1 },
  });
  assert(pools.data.length > 0, 'should have capacity pools');
  const pricings = (pools.data[0] as Record<string, unknown>).qtyBasedPricings;
  assert(Array.isArray(pricings) && pricings.length > 0, 'should have pricings included');
  for (const p of pricings as Array<Record<string, unknown>>) {
    console.log(`    qty=${p.qty} $${p.monthlyPrice}/mo setup=$${p.setupPrice}`);
  }
});

// ─── Included Resources (from README section) ─────────────

console.log('\n== Included Resources ==');

await test('Regions with country include', async () => {
  const regions = await client.regions().list({
    include: 'country',
    page: { size: 3 },
  });
  for (const region of regions.data) {
    if (region.country && isIncluded(region.country)) {
      console.log(`    ${region.name} -> ${region.country.name}`);
    } else {
      console.log(`    ${region.name} (country not included)`);
    }
  }
});

await test('DID groups with stock_keeping_units include', async () => {
  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 3 },
  });
  for (const group of groups.data) {
    for (const sku of group.stockKeepingUnits || []) {
      if (isIncluded(sku)) {
        console.log(`    ${group.prefix} sku.monthlyPrice=${sku.monthlyPrice}`);
      }
    }
  }
});

// ─── Query Parameters ──────────────────────────────────────

console.log('\n== Query Parameters ==');

await test('Regions with filter, sort, pagination', async () => {
  const countries = await client.countries().list({ page: { size: 1 } });
  const countryId = countries.data[0].id;
  const result = await client.regions().list({
    filter: { 'country.id': countryId },
    include: ['country'],
    sort: '-name',
    page: { number: 1, size: 5 },
  });
  assert(Array.isArray(result.data), 'should be array');
  console.log(`    got ${result.data.length} regions for country ${countries.data[0].name}`);
});

// ─── Voice In Trunks (CRUD) ───────────────────────────────

console.log('\n== Voice In Trunks ==');

let createdTrunkId: string | undefined;

await test('Create SIP trunk', async () => {
  const pops = await client.pops().list();
  const popId = pops.data[0].id;
  const trunk = await client.voiceInTrunks().create({
    name: 'Test SIP Trunk',
    configuration: sipConfiguration({
      host: 'sip.example.com',
      port: 5060,
      codecIds: [Codec.PCMU, Codec.PCMA],
      transportProtocolId: TransportProtocol.UDP,
    }),
    pop: ref('pops', popId),
  });
  assert(trunk.data.id !== undefined, 'should have id');
  assert(trunk.data.name === 'Test SIP Trunk', 'name should match');
  assert(trunk.data.configuration.type === 'sip_configurations', 'should be SIP config');
  createdTrunkId = trunk.data.id;
  console.log(`    created SIP trunk: ${trunk.data.id}`);
});

await test('Create PSTN trunk', async () => {
  const pstnTrunk = await client.voiceInTrunks().create({
    name: 'Test PSTN Trunk',
    configuration: pstnConfiguration({ dst: '12125551234' }),
  });
  assert(pstnTrunk.data.id !== undefined, 'should have id');
  assert(pstnTrunk.data.configuration.type === 'pstn_configurations', 'should be PSTN config');
  console.log(`    created PSTN trunk: ${pstnTrunk.data.id}`);
  // Clean up
  await client.voiceInTrunks().remove(pstnTrunk.data.id);
  console.log(`    deleted PSTN trunk`);
});

await test('Update trunk', async () => {
  assert(createdTrunkId !== undefined, 'need created trunk id');
  const updated = await client.voiceInTrunks().update({
    id: createdTrunkId!,
    name: 'Updated SIP Trunk Name',
  });
  assert(updated.data.name === 'Updated SIP Trunk Name', 'name should be updated');
  console.log(`    updated trunk name`);
});

await test('Delete trunk', async () => {
  assert(createdTrunkId !== undefined, 'need created trunk id');
  await client.voiceInTrunks().remove(createdTrunkId!);
  console.log(`    deleted trunk`);
});

// ─── Voice In Trunk Groups ─────────────────────────────────

console.log('\n== Voice In Trunk Groups ==');

await test('Create voice in trunk group', async () => {
  const group = await client.voiceInTrunkGroups().create({
    name: 'Test Primary Group',
    capacityLimit: 50,
  });
  assert(group.data.id !== undefined, 'should have id');
  assert(group.data.name === 'Test Primary Group', 'name should match');
  console.log(`    created group: ${group.data.id}`);
  // Clean up
  await client.voiceInTrunkGroups().remove(group.data.id);
  console.log(`    deleted group`);
});

// ─── Voice Out Trunks ──────────────────────────────────────

console.log('\n== Voice Out Trunks ==');

await test('Create voice out trunk', async () => {
  const voTrunk = await client.voiceOutTrunks().create({
    name: `Test Outbound Trunk ${Math.random().toString(36).substring(2, 8)}`,
    allowedSipIps: ['0.0.0.0/0'],
    defaultDstAction: DefaultDstAction.ALLOW_ALL,
    onCliMismatchAction: OnCliMismatchAction.REJECT_CALL,
  });
  assert(voTrunk.data.id !== undefined, 'should have id');
  console.log(`    created voice out trunk: ${voTrunk.data.id}`);
  // Clean up
  await client.voiceOutTrunks().remove(voTrunk.data.id);
  console.log(`    deleted voice out trunk`);
});

// ─── Orders ────────────────────────────────────────────────

console.log('\n== Orders ==');

await test('Create order by SKU', async () => {
  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 5 },
  });
  let skuId: string | undefined;
  for (const group of groups.data) {
    const skus = group.stockKeepingUnits || [];
    if (skus.length > 0) {
      skuId = skus[0].id;
      break;
    }
  }
  assert(skuId !== undefined, 'need at least one SKU from did_groups');
  const order = await client.orders().create({
    allowBackOrdering: true,
    items: [didOrderItem({ skuId: skuId!, qty: 1 })],
  });
  assert(order.data.id !== undefined, 'should have id');
  assert(Array.isArray(order.data.items), 'should have items');
  console.log(`    created order by SKU: ${order.data.id}, status=${order.data.status}`);
});

await test('Create order by available DID', async () => {
  const available = await client.availableDids().list({
    include: 'did_group.stock_keeping_units',
    page: { size: 1 },
  });
  if (available.data.length > 0) {
    const ad = available.data[0];
    const didGroup = ad.didGroup;
    let skuId: string | undefined;
    if (didGroup && isIncluded(didGroup) && didGroup.stockKeepingUnits?.length) {
      skuId = didGroup.stockKeepingUnits[0].id;
    }
    if (skuId) {
      const order = await client.orders().create({
        items: [availableDidOrderItem({ skuId, availableDidId: ad.id })],
      });
      assert(order.data.id !== undefined, 'should have id');
      console.log(`    created order by available DID: ${order.data.id}`);
    } else {
      console.log('    skipped: no SKU found for available DID');
    }
  } else {
    console.log('    skipped: no available DIDs');
  }
});

// ─── DID Reservations ──────────────────────────────────────

console.log('\n== DID Reservations ==');

await test('Create and delete DID reservation', async () => {
  const available = await client.availableDids().list({ page: { size: 1 } });
  if (available.data.length > 0) {
    const reservation = await client.didReservations().create({
      description: 'Test reserved for client',
      availableDid: ref('available_dids', available.data[0].id),
    });
    assert(reservation.data.id !== undefined, 'should have id');
    console.log(`    created reservation: ${reservation.data.id}`);
    await client.didReservations().remove(reservation.data.id);
    console.log(`    deleted reservation`);
  } else {
    console.log('    skipped: no available DIDs');
  }
});

// ─── Shared Capacity Groups ────────────────────────────────

console.log('\n== Shared Capacity Groups ==');

await test('Create shared capacity group', async () => {
  const pools = await client.capacityPools().list({ page: { size: 1 } });
  if (pools.data.length > 0) {
    const suffix = Math.random().toString(36).substring(2, 8);
    const scg = await client.sharedCapacityGroups().create({
      name: `Test Shared Group ${suffix}`,
      sharedChannelsCount: 1,
      capacityPool: ref('capacity_pools', pools.data[0].id),
    });
    assert(scg.data.id !== undefined, 'should have id');
    console.log(`    created shared capacity group: ${scg.data.id}`);
    // Clean up
    await client.sharedCapacityGroups().remove(scg.data.id);
    console.log(`    deleted shared capacity group`);
  } else {
    console.log('    skipped: no capacity pools available');
  }
});

// ─── Identities ────────────────────────────────────────────

console.log('\n== Identities ==');

let createdIdentityId: string | undefined;

await test('Create identity', async () => {
  const countries = await client.countries().list({ page: { size: 1 } });
  const countryId = countries.data[0].id;
  const identity = await client.identities().create({
    identityType: IdentityType.PERSONAL,
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '12125551234',
    country: ref('countries', countryId),
  });
  assert(identity.data.id !== undefined, 'should have id');
  createdIdentityId = identity.data.id;
  console.log(`    created identity: ${identity.data.id}`);
});

// ─── Addresses ─────────────────────────────────────────────

console.log('\n== Addresses ==');

await test('Create address', async () => {
  assert(createdIdentityId !== undefined, 'need identity id');
  const countries = await client.countries().list({ page: { size: 1 } });
  const countryId = countries.data[0].id;
  const address = await client.addresses().create({
    cityName: 'New York',
    postalCode: '10001',
    address: '123 Main St',
    identity: ref('identities', createdIdentityId!),
    country: ref('countries', countryId),
  });
  assert(address.data.id !== undefined, 'should have id');
  console.log(`    created address: ${address.data.id}`);
  // Clean up
  await client.addresses().remove(address.data.id);
  console.log(`    deleted address`);
});

// Clean up identity
if (createdIdentityId) {
  await client.identities().remove(createdIdentityId);
  console.log('    cleaned up identity');
}

// ─── Exports ───────────────────────────────────────────────

console.log('\n== Exports ==');

await test('Create export', async () => {
  const exp = await client.exports().create({
    exportType: ExportType.CDR_IN,
    filters: { year: 2025, month: 1 },
  });
  assert(exp.data.id !== undefined, 'should have id');
  console.log(`    created export: ${exp.data.id}, status=${exp.data.status}`);
});

// ─── DIDs (list only — update needs existing DID) ─────────

console.log('\n== DIDs ==');

await test('List DIDs', async () => {
  const dids = await client.dids().list({ page: { size: 3 } });
  assert(Array.isArray(dids.data), 'should be array');
  console.log(`    got ${dids.data.length} DIDs`);
});

await test('DIDs with includes', async () => {
  const dids = await client.dids().list({
    include: 'voice_in_trunk,capacity_pool',
    page: { size: 3 },
  });
  for (const did of dids.data) {
    const trunkName = did.voiceInTrunk && isIncluded(did.voiceInTrunk) ? did.voiceInTrunk.name : 'none';
    const poolName = did.capacityPool && isIncluded(did.capacityPool) ? did.capacityPool.name : 'none';
    console.log(`    ${did.number} trunk=${trunkName} pool=${poolName}`);
  }
});

// ─── File Encryption ───────────────────────────────────────

console.log('\n== File Encryption ==');

await test('Encrypt instance-based', async () => {
  const enc = new Encrypt(client);
  const fingerprint = await enc.getFingerprint();
  assert(typeof fingerprint === 'string' && fingerprint.length > 0, 'should have fingerprint');
  const testBuffer = Buffer.from('hello world');
  const encrypted = await enc.encrypt(testBuffer);
  assert(encrypted.length > 0, 'should have encrypted data');
  console.log(`    fingerprint: ${fingerprint.substring(0, 20)}...`);
  console.log(`    encrypted ${testBuffer.length} bytes -> ${encrypted.length} bytes`);
});

await test('Encrypt static functions', async () => {
  const keys = await client.publicKeys().list();
  assert(keys.data.length >= 2, 'should have at least 2 public keys');
  const pems: [string, string] = [keys.data[0].key, keys.data[1].key];
  const fingerprint = calculateFingerprint(pems);
  assert(typeof fingerprint === 'string', 'should have fingerprint');
  const encrypted = encryptWithKeys(Buffer.from('test data'), pems);
  assert(encrypted.length > 0, 'should have encrypted data');
  console.log(`    static fingerprint: ${fingerprint.substring(0, 20)}...`);
});

// ─── Webhook Signature Validation ──────────────────────────

console.log('\n== Webhook Signature Validation ==');

await test('RequestValidator', async () => {
  const validator = new RequestValidator('test-key');
  // Just verify instantiation and method exist
  assert(typeof validator.validate === 'function', 'should have validate method');
  console.log('    RequestValidator instantiated OK');
});

// ─── Error Handling ────────────────────────────────────────

console.log('\n== Error Handling ==');

await test('DidwwApiError on invalid request', async () => {
  try {
    await client.orders().create({
      items: [],
    });
    throw new Error('Should have thrown');
  } catch (error) {
    if (error instanceof DidwwApiError) {
      assert(typeof error.status === 'number', 'should have status');
      assert(Array.isArray(error.errors), 'should have errors array');
      console.log(`    caught DidwwApiError: status=${error.status}, errors=${error.errors.length}`);
      for (const err of error.errors) {
        console.log(`      ${err.detail} (code: ${err.code})`);
      }
    } else {
      throw error;
    }
  }
});

// ─── Configuration ─────────────────────────────────────────

console.log('\n== Configuration ==');

await test('Client with timeout', async () => {
  const clientWithTimeout = new DidwwClient({
    apiKey: API_KEY,
    environment: Environment.PRODUCTION,
    timeout: 30_000,
  });
  // Just verify it creates fine
  assert(clientWithTimeout !== undefined, 'should create client');
  console.log('    client with timeout created OK');
});

// ─── Summary ───────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
}
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
