/**
 * Voice In Trunk Groups: creates two trunks and a trunk group with both, lists
 * the groups, renames the new one and deletes it. Deleting a trunk group also
 * deletes the trunks in it; the group and the trunks are deleted also when a
 * step fails.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/voice-in-trunk-groups.ts
 */
import crypto from 'node:crypto';
import { DidwwClient, Environment, ref, pstnConfiguration, isIncluded } from '../src/index.js';
import type { VoiceInTrunk } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const trunkIds: string[] = [];
  let groupId: string | undefined;
  try {
    // Create two trunks to assign to the group
    const trunk1 = await client.voiceInTrunks().create({
      name: `Group Trunk A ${suffix}`,
      configuration: pstnConfiguration({ dst: '15551000001' }),
    });
    trunkIds.push(trunk1.data.id);
    console.log(`Created trunk A: ${trunk1.data.id}`);

    const trunk2 = await client.voiceInTrunks().create({
      name: `Group Trunk B ${suffix}`,
      configuration: pstnConfiguration({ dst: '15551000002' }),
    });
    trunkIds.push(trunk2.data.id);
    console.log(`Created trunk B: ${trunk2.data.id}`);

    // Create a trunk group with both trunks assigned (2026-04-16 external_reference_id for customer tagging)
    const group = await client.voiceInTrunkGroups().create({
      name: `Primary Failover Group ${suffix}`,
      capacityLimit: 10,
      voiceInTrunks: [ref('voice_in_trunks', trunk1.data.id), ref('voice_in_trunks', trunk2.data.id)],
      externalReferenceId: `ts-tg-${suffix}`,
    });
    groupId = group.data.id;
    console.log(`\nCreated trunk group: ${group.data.id}`);
    console.log(`  name: ${group.data.name}`);
    console.log(`  capacityLimit: ${group.data.capacityLimit}`);
    console.log(`  externalReferenceId: ${group.data.externalReferenceId}`);

    // List trunk groups with included trunks
    const groups = await client.voiceInTrunkGroups().list({
      include: 'voice_in_trunks',
    });
    console.log(`\nAll trunk groups (${groups.data.length}):`);
    for (const g of groups.data) {
      const trunkNames = (g.voiceInTrunks ?? []).filter((t): t is VoiceInTrunk => isIncluded(t)).map((t) => t.name);
      console.log(`  ${g.name} -> trunks: [${trunkNames.join(', ')}]`);
    }

    // Rename the group
    const updated = await client.voiceInTrunkGroups().update({
      id: group.data.id,
      name: `Updated Failover Group ${suffix}`,
    });
    console.log(`\nUpdated group name: ${updated.data.name}`);
  } finally {
    if (groupId) {
      // Deleting the trunk group also deletes its assigned trunks
      await client.voiceInTrunkGroups().remove(groupId);
      console.log('\nDeleted trunk group (with its trunks)');
    } else {
      // Without a group the trunks are deleted one by one
      for (const id of trunkIds) {
        await client.voiceInTrunks().remove(id);
        console.log(`Deleted trunk ${id}`);
      }
    }
  }
}

await main();
