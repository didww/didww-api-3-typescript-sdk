/**
 * DID trunk/trunk group assignment: demonstrates the exclusive relationship.
 *
 * Assigning a trunk to a DID sends its trunk group as null in the same PATCH,
 * and vice versa. This example creates a trunk and a trunk group, assigns them
 * to an existing DID in turn, then restores the DID's original voice routing
 * and deletes the trunk and the trunk group, also when a step fails.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/did-trunk-assignment.ts
 */
import crypto from 'node:crypto';
import { DidwwClient, Environment, isIncluded, pstnConfiguration, ref } from '../src/index.js';
import type { DidWrite, VoiceInTrunk, VoiceInTrunkGroup } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

const VOICE_INCLUDE = 'voice_in_trunk,voice_in_trunk_group';

async function printDidState(didId: string) {
  const did = await client.dids().find(didId, { include: VOICE_INCLUDE });
  const d = did.data;
  const trunk = isIncluded<VoiceInTrunk>(d.voiceInTrunk) ? `${d.voiceInTrunk.name} (${d.voiceInTrunk.id})` : 'null';
  const group = isIncluded<VoiceInTrunkGroup>(d.voiceInTrunkGroup)
    ? `${d.voiceInTrunkGroup.name} (${d.voiceInTrunkGroup.id})`
    : 'null';
  console.log(`   trunk = ${trunk}`);
  console.log(`   group = ${group}`);
}

/** Runs every deletion, also after one of them fails, then reports the failures. */
async function removeEach(removals: Promise<void>[]) {
  const failures = (await Promise.allSettled(removals)).flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
  if (failures.length > 0) throw new AggregateError(failures, 'Cleanup failed');
}

async function main() {
  const dids = await client.dids().list({ include: VOICE_INCLUDE, page: { number: 1, size: 1 } });
  const did = dids.data[0];
  if (!did) {
    throw new Error('No DIDs found. Order a DID first.');
  }
  console.log(`Using DID: ${did.number} (${did.id})`);

  // Remember the current routing to put it back at the end
  const originalTrunkId = did.voiceInTrunk?.id;
  const originalGroupId = did.voiceInTrunkGroup?.id;
  console.log('Current routing:');
  await printDidState(did.id);

  const suffix = crypto.randomBytes(4).toString('hex');
  let trunkId: string | undefined;
  let groupId: string | undefined;
  let didChanged = false;
  try {
    const trunk = await client.voiceInTrunks().create({
      name: `Assignment Trunk ${suffix}`,
      configuration: pstnConfiguration({ dst: '15559990001' }),
    });
    trunkId = trunk.data.id;
    console.log(`\nCreated trunk: ${trunkId}`);

    const group = await client.voiceInTrunkGroups().create({
      name: `Assignment Group ${suffix}`,
      capacityLimit: 10,
    });
    groupId = group.data.id;
    console.log(`Created trunk group: ${groupId}`);

    // 1. Assign the trunk (sends voiceInTrunkGroup as null)
    didChanged = true;
    await client.dids().update({ id: did.id, voiceInTrunk: ref('voice_in_trunks', trunkId) });
    console.log('\n1. Assigned trunk:');
    await printDidState(did.id);

    // 2. Assign the trunk group (sends voiceInTrunk as null)
    await client.dids().update({ id: did.id, voiceInTrunkGroup: ref('voice_in_trunk_groups', groupId) });
    console.log('\n2. Assigned trunk group (the trunk is cleared):');
    await printDidState(did.id);

    // 3. Re-assign the trunk (clears the trunk group again)
    await client.dids().update({ id: did.id, voiceInTrunk: ref('voice_in_trunks', trunkId) });
    console.log('\n3. Re-assigned trunk (the trunk group is cleared):');
    await printDidState(did.id);
  } finally {
    // Restore the DID first, so the created trunk and group are no longer in use.
    // null clears only that relationship, so both are set to unroute the DID.
    let restored = false;
    if (didChanged) {
      let restore: DidWrite & { id: string };
      if (originalTrunkId) {
        restore = { id: did.id, voiceInTrunk: ref('voice_in_trunks', originalTrunkId) };
      } else if (originalGroupId) {
        restore = { id: did.id, voiceInTrunkGroup: ref('voice_in_trunk_groups', originalGroupId) };
      } else {
        restore = { id: did.id, voiceInTrunk: null, voiceInTrunkGroup: null };
      }
      await client.dids().update(restore);
      restored = true;
    }
    // No longer in use: the trunk and the group are deleted independently
    const removals: Promise<void>[] = [];
    if (trunkId)
      removals.push(
        client
          .voiceInTrunks()
          .remove(trunkId)
          .then(() => console.log('Deleted trunk')),
      );
    if (groupId) {
      removals.push(
        client
          .voiceInTrunkGroups()
          .remove(groupId)
          .then(() => console.log('Deleted trunk group')),
      );
    }
    await removeEach(removals);
    // Read last, so that a failed read cannot keep the trunk and the group from being deleted
    if (restored) {
      console.log("\nRestored the DID's original routing:");
      await printDidState(did.id);
    }
  }
}

await main();
