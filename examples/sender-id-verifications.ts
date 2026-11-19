/**
 * Sender ID Verifications: lists verifications with their SMS trunks, renames an
 * active one and restores its original name, also when a step fails.
 *
 * A verification is created and reviewed outside the API; only its name and its
 * SMS trunk can be changed, and a closed one cannot be changed at all. Only
 * http_out, smpp_esme and smpp_smsc trunks are accepted as its SMS trunk.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/sender-id-verifications.ts
 */
import {
  DidwwClient,
  Environment,
  SenderIdVerificationStatus,
  isIncluded,
  isSenderIdVerificationActive,
  isSenderIdVerificationChangesRequired,
} from '../src/index.js';
import type { SenderIdVerification, SmsTrunk } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

function trunkName(v: SenderIdVerification): string {
  return isIncluded<SmsTrunk>(v.smsTrunk) ? v.smsTrunk.name : 'no SMS trunk';
}

function printVerification(v: SenderIdVerification) {
  console.log(`${v.reference} ${v.name} (${v.senderType}, ${v.status}): ${v.senderIds.join(', ')} via ${trunkName(v)}`);
  if (isSenderIdVerificationChangesRequired(v)) {
    console.log(`  changes required: ${(v.rejectReasons || []).join('; ')} ${v.rejectComment ?? ''}`);
  }
  // Prices are decimal strings; the renew date is "YYYY-MM-DD", null once closed
  console.log(`  setup price: ${v.meta?.setupPrice}, monthly price: ${v.meta?.monthlyPrice}, renews: ${v.renewDate}`);
}

async function main() {
  console.log('=== Sender ID Verifications ===');
  const verifications = await client.senderIdVerifications().list({ include: 'sms_trunk' });
  for (const v of verifications.data) {
    printVerification(v);
  }

  const verification = verifications.data.find((v) => isSenderIdVerificationActive(v));
  if (!verification) {
    console.log('No active Sender ID verification');
    return;
  }

  const originalName = verification.name;

  console.log(`\n=== Renaming ${verification.reference} ===`);
  try {
    const renamed = await client.senderIdVerifications().update({
      id: verification.id,
      name: `${originalName} (renamed)`,
    });
    console.log(`Name: ${renamed.data.name}`);
  } finally {
    await client.senderIdVerifications().update({ id: verification.id, name: originalName });
    console.log(`Name restored: ${originalName}`);
  }

  // Routing through an SMS trunk that sends messages works the same way; null
  // unassigns the trunk, which stops outbound messages until one is assigned again:
  //
  //   await client.senderIdVerifications().update({
  //     id: verification.id,
  //     smsTrunk: ref('sms_trunks', sendingTrunkId),
  //   });

  console.log('\nActive verifications by SMS trunk:');
  const trunk = verification.smsTrunk;
  if (trunk) {
    const sameTrunk = await client.senderIdVerifications().list({
      filter: { status: SenderIdVerificationStatus.ACTIVE, 'sms_trunk.id': trunk.id },
    });
    for (const v of sameTrunk.data) {
      console.log(`  ${v.reference} ${v.name} via ${trunkName(verification)}`);
    }
  } else {
    console.log(`  ${verification.reference} has no SMS trunk`);
  }
}

main().catch(console.error);
