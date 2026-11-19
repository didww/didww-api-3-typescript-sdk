/**
 * DID SMS routing: routes a DID's inbound SMS to an SMS trunk, then to an SMS
 * trunk group. The two are exclusive: assigning one sends the other as null in
 * the same PATCH, just like voiceInTrunk and voiceInTrunkGroup; setting both
 * throws. At the end the DID's original SMS routing is restored, also when a
 * step fails.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/did-sms-routing.ts
 */
import { DidwwClient, Environment, ref } from '../src/index.js';
import type { DidWrite } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

const SMS_INCLUDE = 'sms_trunk,sms_trunk_group';

async function printSmsRouting(didId: string) {
  const did = await client.dids().find(didId, { include: SMS_INCLUDE });
  console.log(`   smsTrunk      = ${did.data.smsTrunk?.id ?? 'null'}`);
  console.log(`   smsTrunkGroup = ${did.data.smsTrunkGroup?.id ?? 'null'}`);
}

async function main() {
  console.log('=== Finding DID ===');
  const dids = await client.dids().list({ include: SMS_INCLUDE, page: { number: 1, size: 1 } });
  const did = dids.data[0];
  if (!did) {
    console.log('No DIDs found. Please order a DID first.');
    return;
  }
  console.log(`Using DID: ${did.number} (${did.id})`);

  console.log('\n=== Finding inbound SMS trunk ===');
  const trunks = await client.smsTrunks().list();
  const trunk = trunks.data.find((t) => t.allowIn);
  if (!trunk) {
    console.log('No inbound SMS trunk found. Run examples/sms-trunks.ts or create one first.');
    return;
  }
  console.log(`Selected SMS trunk: ${trunk.name} (${trunk.id})`);

  console.log('\n=== Finding SMS trunk group ===');
  const groups = await client.smsTrunkGroups().list({ page: { number: 1, size: 1 } });
  const group = groups.data[0];
  if (group) {
    console.log(`Selected SMS trunk group: ${group.name} (${group.id})`);
  } else {
    console.log('No SMS trunk group found; step 2 is skipped.');
  }

  // Remember the current routing to put it back at the end
  const originalTrunkId = did.smsTrunk?.id;
  const originalGroupId = did.smsTrunkGroup?.id;
  console.log('\nCurrent SMS routing:');
  await printSmsRouting(did.id);

  let didChanged = false;
  try {
    // 1. Assign the SMS trunk (sends smsTrunkGroup as null)
    console.log('\n=== 1. Assigning SMS trunk to DID ===');
    didChanged = true;
    await client.dids().update({ id: did.id, smsTrunk: ref('sms_trunks', trunk.id) });
    await printSmsRouting(did.id);

    console.log(`\n=== DIDs routed to ${trunk.name} ===`);
    const routed = await client.dids().list({ filter: { 'sms_trunk.id': trunk.id } });
    for (const d of routed.data) {
      console.log(`   ${d.number}`);
    }

    // 2. Assign the SMS trunk group (sends smsTrunk as null)
    if (group) {
      console.log('\n=== 2. Assigning SMS trunk group to DID (clears the SMS trunk) ===');
      await client.dids().update({ id: did.id, smsTrunkGroup: ref('sms_trunk_groups', group.id) });
      await printSmsRouting(did.id);
    }
  } finally {
    if (didChanged) {
      // 3. Restore the original routing. null unassigns only that
      // relationship, so both are set to unroute the DID's inbound SMS.
      console.log("\n=== 3. Restoring the DID's original SMS routing ===");
      let restore: DidWrite & { id: string };
      if (originalTrunkId) {
        restore = { id: did.id, smsTrunk: ref('sms_trunks', originalTrunkId) };
      } else if (originalGroupId) {
        restore = { id: did.id, smsTrunkGroup: ref('sms_trunk_groups', originalGroupId) };
      } else {
        restore = { id: did.id, smsTrunk: null, smsTrunkGroup: null };
      }
      await client.dids().update(restore);
      await printSmsRouting(did.id);
    }
  }
}

main().catch(console.error);
