/**
 * End-to-end Emergency Calling Service purchase flow (2026-04-16).
 *
 * Walks through the full lifecycle:
 *   0. Find an address with country, order a DID with emergency feature in that country
 *   1. Find the newly ordered DID (not yet emergency-enabled, no ECS)
 *   2. Look up emergency requirements for that DID's country + did_group_type
 *   3. Find an existing identity on the account
 *   4. Find an existing address on the account
 *   5. Validate the triple (requirement + address + identity)
 *   6. Create an emergency verification
 *   7. Check verification status
 *   8. Fetch the auto-created emergency_calling_service
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/emergency-scenario.ts
 */
import { DidwwClient, Environment, availableDidOrderItem, isIncluded } from '../src/index.js';
import type { Did } from '../src/resources/did.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // === Step 0: Order an available DID with emergency feature ===
  console.log('=== Step 0: Order an available DID with emergency feature ===');

  // Find an address first so we know what country to order in
  const addressesForOrder = await client.addresses().list({
    include: ['country'],
  });
  if (addressesForOrder.data.length === 0) {
    console.log('No addresses on this account. Please create an address first.');
    return;
  }
  const addressForOrder = addressesForOrder.data[0];
  const addressCountry =
    addressForOrder.country && isIncluded(addressForOrder.country) ? addressForOrder.country : null;
  const addressCountryId = addressForOrder.country?.id;
  console.log(`  Using address country: ${addressCountry?.name ?? 'unknown'} (${addressCountryId})`);

  // Find an available DID with emergency feature in that country
  const availableDids = await client.availableDids().list({
    filter: { 'did_group.features': 'emergency', 'country.id': addressCountryId },
    include: ['did_group', 'did_group.stock_keeping_units'],
    page: { size: 1, number: 1 },
  });

  if (availableDids.data.length === 0) {
    console.log('No available DIDs with emergency feature in this country.');
    return;
  }

  const availableDid = availableDids.data[0];
  const adDidGroup = availableDid.didGroup;
  const skus = adDidGroup && isIncluded(adDidGroup) ? adDidGroup.stockKeepingUnits || [] : [];
  if (!Array.isArray(skus) || skus.length === 0) {
    console.log('No SKU found for this DID group.');
    return;
  }
  const skuId = skus[0].id;

  console.log(`  Available DID: ${availableDid.number}`);
  console.log(`  DID Group: ${adDidGroup && isIncluded(adDidGroup) ? adDidGroup.areaName : adDidGroup?.id}`);

  const orderResult = await client.orders().create({
    items: [availableDidOrderItem({ skuId, availableDidId: availableDid.id })],
  });
  let order = orderResult.data;
  console.log(`  Order: ${order.id} -- ${order.status}`);

  // Wait for order to complete
  for (let i = 0; i < 10; i++) {
    if (order.status === 'completed') break;
    await sleep(5000);
    const fetched = await client.orders().find(order.id);
    order = fetched.data;
  }
  if (order.status !== 'completed') {
    console.log(`  Order did not complete (status: ${order.status}).`);
    return;
  }
  console.log('  Order completed');

  // === Step 1: Find the newly ordered DID ===
  console.log('\n=== Step 1: Find the newly ordered DID ===');
  const dids = await client.dids().list({
    filter: { 'did_group.features': 'emergency', emergency_enabled: false },
    include: ['did_group', 'did_group.country', 'did_group.did_group_type', 'emergency_calling_service'],
    sort: '-created_at',
    page: { size: 10, number: 1 },
  });

  // Pick a DID that is not yet assigned to an ECS
  const did = dids.data.find((d) => !d.emergencyCallingService);
  if (!did) {
    console.log('No available DID without an existing Emergency Calling Service.');
    return;
  }

  const didGroup = did.didGroup && isIncluded(did.didGroup) ? did.didGroup : null;
  const country = didGroup?.country && isIncluded(didGroup.country) ? didGroup.country : null;
  const dgt = didGroup?.didGroupType && isIncluded(didGroup.didGroupType) ? didGroup.didGroupType : null;

  console.log(`  DID:            ${did.number} (${did.id})`);
  console.log(`  DID Group:      ${didGroup?.id}`);
  console.log(`  Country:        ${country?.name} (${country?.id})`);
  console.log(`  DID Group Type: ${dgt?.name} (${dgt?.id})`);

  // === Step 2: Get emergency requirements ===
  console.log('\n=== Step 2: Get emergency requirements for country + did_group_type ===');
  if (!country?.id || !dgt?.id) {
    console.log('DID group missing country or type relationship. Exiting.');
    return;
  }

  const requirements = await client.emergencyRequirements().list({
    filter: { 'country.id': country.id, 'did_group_type.id': dgt.id },
  });

  const requirement = requirements.data[0];
  if (!requirement) {
    console.log(`No emergency requirements found for country ${country.name} / ${dgt.name}.`);
    return;
  }

  console.log(`  Emergency Requirement: ${requirement.id}`);
  console.log(`  Identity type:         ${requirement.identityType}`);
  console.log(`  Address area level:    ${requirement.addressAreaLevel}`);
  console.log(`  Estimated setup (days): ${requirement.estimateSetupTime}`);

  // === Step 3: Find an existing identity ===
  console.log('\n=== Step 3: Find an existing identity ===');
  const identities = await client.identities().list();
  const identity = identities.data[0];
  if (!identity) {
    console.log('No identities found on this account. Please create an identity first.');
    return;
  }

  console.log(`  Identity: ${identity.id}`);
  console.log(`  Type:     ${identity.identityType}`);

  // === Step 4: Find an existing address ===
  console.log('\n=== Step 4: Find an existing address ===');
  const addresses = await client.addresses().list();
  const address = addresses.data[0];
  if (!address) {
    console.log('No addresses found on this account. Please create an address first.');
    return;
  }

  console.log(`  Address: ${address.id}`);

  // === Step 5: Validate the order setup ===
  console.log('\n=== Step 5: Validate emergency requirement (requirement + address + identity) ===');
  try {
    await client.emergencyRequirementValidations().create({
      emergencyRequirement: { id: requirement.id, type: 'emergency_requirements' },
      address: { id: address.id, type: 'addresses' },
      identity: { id: identity.id, type: 'identities' },
    });
    console.log('  Validation passed -- this combination can be used for emergency calling.');
  } catch (err) {
    console.log('  Validation failed:');
    console.error(err);
    console.log('Cannot proceed without a valid requirement/address/identity combination.');
    return;
  }

  // === Step 6: Create an emergency verification ===
  console.log('\n=== Step 6: Create emergency verification ===');
  const suffix = Date.now().toString(36);
  try {
    const verification = await client.emergencyVerifications().create({
      callbackUrl: 'https://example.com/webhooks/emergency',
      callbackMethod: 'post' as const,
      externalReferenceId: `ts-scenario-${suffix}`,
      address: { id: address.id, type: 'addresses' },
      dids: [{ id: did.id, type: 'dids' }],
    });
    console.log(`  Created verification: ${verification.data.id}`);
    console.log(`  Reference:            ${verification.data.reference}`);
    console.log(`  Status:               ${verification.data.status}`);
    console.log(`  External Reference:   ${verification.data.externalReferenceId}`);

    // === Step 7: Fetch the verification to confirm status ===
    console.log('\n=== Step 7: Fetch the created verification ===');
    const fetched = await client.emergencyVerifications().find(verification.data.id, {
      include: ['address', 'emergency_calling_service', 'dids'],
    });
    console.log(`  Verification: ${fetched.data.id}`);
    console.log(`  Status:       ${fetched.data.status}`);
    console.log(`  Reference:    ${fetched.data.reference}`);
    if (fetched.data.dids && fetched.data.dids.length > 0) {
      const numbers = fetched.data.dids.filter((d): d is Did => isIncluded(d)).map((d) => d.number);
      console.log(`  DIDs:         ${numbers.join(', ')}`);
    }
    if (fetched.data.address) {
      console.log(`  Address:      ${fetched.data.address.id}`);
    }

    // === Step 8: Fetch the auto-created emergency_calling_service ===
    console.log('\n=== Step 8: Fetch emergency calling service ===');
    const ecs = fetched.data.emergencyCallingService;
    if (ecs) {
      const service = await client.emergencyCallingServices().find(ecs.id, {
        include: ['country', 'did_group_type', 'dids'],
      });
      const svc = service.data;
      console.log(`  Service:        ${svc.id}`);
      console.log(`  Name:           ${svc.name}`);
      console.log(`  Reference:      ${svc.reference}`);
      console.log(`  Status:         ${svc.status}`);
      if (svc.country && isIncluded(svc.country)) {
        console.log(`  Country:        ${svc.country.name}`);
      }
      if (svc.didGroupType && isIncluded(svc.didGroupType)) {
        console.log(`  DID Group Type: ${svc.didGroupType.name}`);
      }
      if (svc.dids && svc.dids.length > 0) {
        const numbers = svc.dids.filter((d): d is Did => isIncluded(d)).map((d) => d.number);
        console.log(`  Attached DIDs:  ${numbers.join(', ')}`);
      }
    } else {
      console.log('  No emergency_calling_service linked yet (may be created asynchronously).');
    }
  } catch (err) {
    console.log('  Error creating verification:');
    console.error(err);
    return;
  }

  console.log('\nDone! Emergency calling service flow completed.');
}

await main();
