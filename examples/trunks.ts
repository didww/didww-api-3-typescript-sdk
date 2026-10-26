import { DidwwClient, Environment, Pop, pstnConfiguration } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Create a PSTN trunk (simplest config)
  const trunk = await client.voiceInTrunks().create({
    name: 'Example PSTN Trunk',
    configuration: pstnConfiguration({ dst: '15551234567' }),
  });
  console.log(`Created trunk: ${trunk.data.id} - ${trunk.data.name}`);
  console.log(`  Config type: ${trunk.data.configuration.type}`);
  console.log(`  POP: ${trunk.data.pop ?? 'none'}`);

  // List all trunks
  const trunks = await client.voiceInTrunks().list();
  console.log(`\nFound ${trunks.data.length} trunks`);
  for (const t of trunks.data) {
    console.log(`  ${t.name} (${t.configuration.type}, POP ${t.pop ?? 'none'})`);
  }

  // Update the trunk; the point of presence is a Pop value, null clears it
  const updated = await client.voiceInTrunks().update({
    id: trunk.data.id,
    name: 'Updated PSTN Trunk',
    pop: Pop.FRA,
  });
  console.log(`\nUpdated trunk: ${updated.data.name}, POP ${updated.data.pop}`);

  // Delete the trunk
  await client.voiceInTrunks().remove(trunk.data.id);
  console.log('Trunk deleted');
}

main().catch(console.error);
