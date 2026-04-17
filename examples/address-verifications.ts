/**
 * Address Verifications: list and inspect (with 2026-04-16 reject_comment / external_reference_id).
 *
 * AddressVerification ties an address to one or more DIDs and a set of
 * supporting documents so DIDWW compliance can approve or reject the
 * declaration. 2026-04-16 adds:
 *   - reject_comment: free-form comment accompanying a rejection
 *   - external_reference_id: customer-supplied reference (max 100 chars)
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/address-verifications.ts
 */
import { DidwwClient, Environment } from '../src/index.js';
import type { Did } from '../src/resources/did.js';
import { isIncluded } from '../src/resources/base.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  console.log('=== Address Verifications ===');
  const verifications = await client.addressVerifications().list({
    include: ['address', 'dids'],
  });
  console.log(`Found ${verifications.data.length} address verifications`);

  for (const av of verifications.data.slice(0, 5)) {
    console.log(`\nVerification: ${av.id}`);
    console.log(`  Reference: ${av.reference}`);
    console.log(`  Status: ${av.status}`);
    if (av.externalReferenceId) console.log(`  External Reference: ${av.externalReferenceId}`);
    if (av.serviceDescription) console.log(`  Service description: ${av.serviceDescription}`);
    if (av.address) console.log(`  Address: ${av.address.id}`);
    if (av.dids && av.dids.length > 0) {
      const numbers = av.dids
        .filter(d => isIncluded(d))
        .map(d => (d as Did).number);
      console.log(`  DIDs: ${numbers.join(', ')}`);
    }
    if (av.status === 'rejected') {
      if (av.rejectReasons?.length) console.log(`  Reject reasons: ${av.rejectReasons.join(', ')}`);
      if (av.rejectComment) console.log(`  Reject comment: ${av.rejectComment}`);
    }
  }

  // Filter: only rejected verifications
  console.log('\n=== Rejected verifications ===');
  const rejected = await client.addressVerifications().list({
    filter: { status: 'rejected' },
  });
  console.log(`Found ${rejected.data.length} rejected verifications`);
  for (const av of rejected.data.slice(0, 3)) {
    console.log(`  ${av.reference}: ${av.rejectComment || av.rejectReasons?.join(', ')}`);
  }
}

main().catch(console.error);
