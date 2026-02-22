import { DidwwClient, Environment, sipConfiguration, ref } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Create a SIP trunk
  const trunk = await client.voiceInTrunks().create({
    name: 'My SIP Trunk',
    configuration: sipConfiguration({
      host: 'sip.example.com',
      port: 5060,
      codec_ids: [9, 10],
    }),
    pop: ref('pops', 'some-pop-id'),
  });
  console.log('Created trunk:', trunk.data.id, trunk.data.name);

  // List all trunks
  const trunks = await client.voiceInTrunks().list();
  console.log(`\nFound ${trunks.data.length} trunks`);
  for (const t of trunks.data) {
    console.log(`  ${t.name} (${t.configuration.type})`);
  }

  // Update a trunk
  const updated = await client.voiceInTrunks().update({
    id: trunk.data.id,
    name: 'Updated SIP Trunk',
  });
  console.log(`\nUpdated trunk name: ${updated.data.name}`);

  // Delete the trunk
  await client.voiceInTrunks().remove(trunk.data.id);
  console.log('Trunk deleted');
}

main().catch(console.error);
