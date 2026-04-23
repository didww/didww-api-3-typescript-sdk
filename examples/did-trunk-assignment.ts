/**
 * DID trunk/trunk group assignment: demonstrates exclusive relationship behavior.
 *
 * When assigning a trunk to a DID, the trunk group is automatically nullified, and vice versa.
 * This example creates trunks, a trunk group, and a DID (via order), then exercises
 * all assignment and unassignment scenarios.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/did-trunk-assignment.ts
 */
import { DidwwClient, Environment, ref, isIncluded, pstnConfiguration, availableDidOrderItem } from '../src/index.js';
import crypto from 'node:crypto';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // --- Setup: create a trunk, a trunk group, and get a DID ---

  const suffix = crypto.randomBytes(4).toString('hex');

  // Create a trunk
  const trunk = await client.voiceInTrunks().create({
    name: `Assignment Test Trunk ${suffix}`,
    configuration: pstnConfiguration({ dst: '15559990001' }),
  });
  console.log(`Created trunk: ${trunk.data.id} (${trunk.data.name})`);

  // Create a trunk group
  const group = await client.voiceInTrunkGroups().create({
    name: `Assignment Test Group ${suffix}`,
    capacityLimit: 5,
    voiceInTrunks: [ref('voice_in_trunks', trunk.data.id)],
  });
  console.log(`Created trunk group: ${group.data.id} (${group.data.name})`);

  // Get a DID (use existing or order one)
  let dids = await client.dids().list({ page: { size: 1 } });
  let didId: string;
  if (dids.data.length > 0) {
    didId = dids.data[0].id;
    console.log(`Using existing DID: ${dids.data[0].number} (${didId})`);
  } else {
    // Order a DID
    const available = await client.availableDids().list({
      include: 'did_group.stock_keeping_units',
      page: { size: 1 },
    });
    if (available.data.length === 0) {
      console.log('No available DIDs to order. Exiting.');
      await cleanup(trunk.data.id, group.data.id);
      return;
    }
    const ad = available.data[0];
    const didGroup = ad.didGroup;
    const skus = (didGroup as Record<string, unknown>)?.stockKeepingUnits;
    if (!Array.isArray(skus) || skus.length === 0) {
      console.log('No SKUs found. Exiting.');
      await cleanup(trunk.data.id, group.data.id);
      return;
    }
    const order = await client.orders().create({
      items: [availableDidOrderItem({ skuId: skus[0].id, availableDidId: ad.id })],
    });
    console.log(`Ordered DID: order ${order.data.id}`);
    dids = await client.dids().list({ filter: { 'order.id': order.data.id } });
    didId = dids.data[0].id;
    console.log(`Got DID: ${dids.data[0].number} (${didId})`);
  }

  // --- Scenario 1: Assign trunk to DID ---
  console.log('\n--- Assign trunk to DID ---');
  const afterTrunk = await client.dids().update({
    id: didId,
    voiceInTrunk: ref('voice_in_trunks', trunk.data.id),
  });
  await printDidState(didId);

  // --- Scenario 2: Assign trunk group to DID (should nullify trunk) ---
  console.log('\n--- Assign trunk GROUP to DID (auto-nullifies trunk) ---');
  const afterGroup = await client.dids().update({
    id: didId,
    voiceInTrunkGroup: ref('voice_in_trunk_groups', group.data.id),
  });
  await printDidState(didId);

  // --- Scenario 3: Assign trunk again (should nullify trunk group) ---
  console.log('\n--- Re-assign trunk to DID (auto-nullifies trunk group) ---');
  await client.dids().update({
    id: didId,
    voiceInTrunk: ref('voice_in_trunks', trunk.data.id),
  });
  await printDidState(didId);

  // --- Scenario 4: Unassign trunk (set to null) ---
  console.log('\n--- Unassign trunk (set to null) ---');
  await client.dids().update({
    id: didId,
    voiceInTrunk: null,
  });
  await printDidState(didId);

  // --- Clean up ---
  await cleanup(trunk.data.id, group.data.id);
}

async function printDidState(didId: string) {
  const did = await client.dids().find(didId, {
    include: 'voice_in_trunk,voice_in_trunk_group',
  });
  const d = did.data;
  const trunkInfo =
    d.voiceInTrunk && isIncluded(d.voiceInTrunk)
      ? `${d.voiceInTrunk.name} (${d.voiceInTrunk.id})`
      : d.voiceInTrunk
        ? `ref(${d.voiceInTrunk.id})`
        : 'null';
  const groupInfo =
    d.voiceInTrunkGroup && isIncluded(d.voiceInTrunkGroup)
      ? `${d.voiceInTrunkGroup.name} (${d.voiceInTrunkGroup.id})`
      : d.voiceInTrunkGroup
        ? `ref(${d.voiceInTrunkGroup.id})`
        : 'null';
  console.log(`  DID ${d.number}: trunk=${trunkInfo}, trunkGroup=${groupInfo}`);
}

async function cleanup(trunkId: string, groupId: string) {
  console.log('\n--- Cleanup ---');
  // Unassign trunks from group before deleting to avoid cascade
  try {
    await client.voiceInTrunkGroups().update({ id: groupId, voiceInTrunks: [] });
  } catch {
    /* group may already be gone */
  }
  try {
    await client.voiceInTrunkGroups().remove(groupId);
    console.log('Deleted trunk group');
  } catch {
    console.log('Trunk group already deleted');
  }
  try {
    await client.voiceInTrunks().remove(trunkId);
    console.log('Deleted trunk');
  } catch {
    console.log('Trunk already deleted');
  }
}

main().catch(console.error);
