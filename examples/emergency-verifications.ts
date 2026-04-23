/**
 * Emergency Verifications: create and list emergency verifications (2026-04-16).
 *
 * An EmergencyVerification submits an address and a list of DIDs against an
 * EmergencyCallingService for compliance review. The server returns a status
 * of "pending" and later moves to "approved" / "rejected".
 *
 * Supported operations: list, find, create, update.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/emergency-verifications.ts
 */
import { DidwwClient, Environment } from '../src/index.js';
import type { EmergencyVerification } from '../src/resources/emergency-verification.js';
import type { Did } from '../src/resources/did.js';
import { isIncluded } from '../src/resources/base.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

function printVerification(ev: EmergencyVerification) {
  console.log(`\nVerification: ${ev.id}`);
  console.log(`  Reference: ${ev.reference}`);
  console.log(`  Status: ${ev.status}`);
  if (ev.externalReferenceId) console.log(`  External Reference: ${ev.externalReferenceId}`);
  if (ev.address) console.log(`  Address: ${ev.address.id}`);
  if (ev.emergencyCallingService) console.log(`  Emergency Calling Service: ${ev.emergencyCallingService.id}`);
  if (ev.dids && ev.dids.length > 0) {
    const numbers = ev.dids.filter((d): d is Did => isIncluded(d)).map((d) => d.number);
    console.log(`  DIDs: ${numbers.join(', ')}`);
  }
  if (ev.status === 'rejected') {
    if (ev.rejectReasons?.length) console.log(`  Reject reasons: ${ev.rejectReasons.join(', ')}`);
    if (ev.rejectComment) console.log(`  Reject comment: ${ev.rejectComment}`);
  }
}

async function main() {
  // List existing verifications
  console.log('=== Emergency Verifications ===');
  const verifications = await client.emergencyVerifications().list({
    include: ['address', 'emergency_calling_service', 'dids'],
  });
  console.log(`Found ${verifications.data.length} emergency verifications`);

  for (const ev of verifications.data.slice(0, 5)) {
    printVerification(ev);
  }

  // Filter by status
  console.log('\n=== Only approved verifications ===');
  const approved = await client.emergencyVerifications().list({
    filter: { status: 'approved' },
  });
  console.log(`Found ${approved.data.length} approved verifications`);

  // Create a new verification -- requires an existing EmergencyCallingService,
  // Address, and Did. Uncomment and replace the IDs below to try:
  //
  // const verification = await client.emergencyVerifications().create({
  //   address: { id: '<address-uuid>', type: 'addresses' },
  //   emergencyCallingService: { id: '<ecs-uuid>', type: 'emergency_calling_services' },
  //   dids: [{ id: '<did-uuid>', type: 'dids' }],
  //   externalReferenceId: `ts-ev-${crypto.randomBytes(4).toString('hex')}`,
  // });
  // console.log(`Created verification ${verification.data.id} (status: ${verification.data.status})`);
}

await main();
