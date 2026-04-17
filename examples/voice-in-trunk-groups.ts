/**
 * Voice In Trunk Groups: CRUD with trunk relationships.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/voice-in-trunk-groups.ts
 */
import { DidwwClient, Environment, ref, pstnConfiguration, isIncluded } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Create two trunks to assign to the group
  const suffix = Math.random().toString(36).substring(2, 8);
  const trunk1 = await client.voiceInTrunks().create({
    name: `Group Trunk A ${suffix}`,
    configuration: pstnConfiguration({ dst: '15551000001' }),
  });
  console.log(`Created trunk A: ${trunk1.data.id}`);

  const trunk2 = await client.voiceInTrunks().create({
    name: `Group Trunk B ${suffix}`,
    configuration: pstnConfiguration({ dst: '15551000002' }),
  });
  console.log(`Created trunk B: ${trunk2.data.id}`);

  // Create a trunk group with both trunks assigned (2026-04-16 external_reference_id for customer tagging)
  const group = await client.voiceInTrunkGroups().create({
    name: `Primary Failover Group ${suffix}`,
    capacityLimit: 10,
    voiceInTrunks: [ref('voice_in_trunks', trunk1.data.id), ref('voice_in_trunks', trunk2.data.id)],
    externalReferenceId: `ts-tg-${suffix}`,
  });
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
    const trunks = g.voiceInTrunks || [];
    const trunkNames = trunks.filter((t) => isIncluded(t)).map((t) => (t as { name: string }).name);
    console.log(`  ${g.name} -> trunks: [${trunkNames.join(', ')}]`);
  }

  // Update group name
  const updated = await client.voiceInTrunkGroups().update({
    id: group.data.id,
    name: `Updated Failover Group ${suffix}`,
  });
  console.log(`\nUpdated group name: ${updated.data.name}`);

  // Remove one trunk from group by reassigning with only one
  const updatedTrunks = await client.voiceInTrunkGroups().update({
    id: group.data.id,
    voiceInTrunks: [ref('voice_in_trunks', trunk1.data.id)],
  });
  console.log('Reassigned group to single trunk');

  // Clean up: deleting a trunk group also deletes its assigned trunks
  await client.voiceInTrunkGroups().remove(group.data.id);
  console.log('\nDeleted trunk group (cascades to assigned trunks)');
}

main().catch(console.error);
