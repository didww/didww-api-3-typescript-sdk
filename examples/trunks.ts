import { DidwwClient, Environment, sipConfiguration, pstnConfiguration } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get a valid POP
  const pops = await client.pops().list();
  if (pops.data.length === 0) {
    console.log('No POPs available');
    return;
  }
  const pop = pops.data[0];
  console.log(`Using POP: ${pop.name} (${pop.id})`);

  // Create a PSTN trunk (simplest config, no POP required)
  const trunk = await client.voiceInTrunks().create({
    name: 'Example PSTN Trunk',
    configuration: pstnConfiguration({ dst: '15551234567' }),
  });
  console.log(`Created trunk: ${trunk.data.id} - ${trunk.data.name}`);
  console.log(`  Config type: ${trunk.data.configuration.type}`);

  // List all trunks
  const trunks = await client.voiceInTrunks().list();
  console.log(`\nFound ${trunks.data.length} trunks`);
  for (const t of trunks.data) {
    console.log(`  ${t.name} (${t.configuration.type})`);
  }

  // Update the trunk
  const updated = await client.voiceInTrunks().update({
    id: trunk.data.id,
    name: 'Updated PSTN Trunk',
  });
  console.log(`\nUpdated trunk name: ${updated.data.name}`);

  // Delete the trunk
  await client.voiceInTrunks().remove(trunk.data.id);
  console.log('Trunk deleted');
}

main().catch(console.error);
