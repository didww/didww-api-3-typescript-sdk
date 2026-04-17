/**
 * Emergency Calling Services: list and cancel customer 911/112 subscriptions (2026-04-16).
 *
 * An EmergencyCallingService represents a customer's 911/112 subscription
 * attached to one or more DIDs. It ties an address, identity, DID group type
 * and country together.
 *
 * Supported operations: list, find, remove (cancel).
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/emergency-calling-services.ts
 */
import { DidwwClient, Environment } from '../src/index.js';
import type { Did } from '../src/resources/did.js';
import { isIncluded } from '../src/resources/base.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  console.log('=== Emergency Calling Services ===');
  const services = await client.emergencyCallingServices().list({
    include: ['country', 'did_group_type', 'dids'],
  });
  console.log(`Found ${services.data.length} emergency calling services`);

  for (const svc of services.data.slice(0, 5)) {
    console.log(`\nService: ${svc.id}`);
    console.log(`  Name: ${svc.name}`);
    console.log(`  Reference: ${svc.reference}`);
    console.log(`  Status: ${svc.status}`);
    if (svc.country && isIncluded(svc.country)) {
      console.log(`  Country: ${svc.country.name}`);
    }
    if (svc.didGroupType && isIncluded(svc.didGroupType)) {
      console.log(`  DID Group Type: ${svc.didGroupType.name}`);
    }
    console.log(`  Activated: ${svc.activatedAt}`);
    if (svc.canceledAt) console.log(`  Canceled: ${svc.canceledAt}`);
    if (svc.renewDate) console.log(`  Renews: ${svc.renewDate}`);
    if (svc.dids && svc.dids.length > 0) {
      const numbers = svc.dids
        .filter((d): d is Did => isIncluded(d))
        .map(d => d.number);
      console.log(`  Attached DIDs: ${numbers.join(', ')}`);
    }
  }

  // Filter by status
  console.log('\n=== Only active emergency calling services ===');
  const active = await client.emergencyCallingServices().list({
    filter: { status: 'active' },
  });
  console.log(`Found ${active.data.length} active services`);

  // Cancel a service (remove) -- uncomment to try:
  //
  // const svcToCancel = services.data.find(s => s.status === 'active');
  // if (svcToCancel) {
  //   console.log(`\nCancelling service ${svcToCancel.id}...`);
  //   await client.emergencyCallingServices().remove(svcToCancel.id);
  //   console.log('Service cancelled');
  // }
}

await main();
