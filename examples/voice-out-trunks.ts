/**
 * Voice Out Trunks: CRUD operations.
 * Note: Voice Out Trunks and some OnCliMismatchAction values (e.g. REPLACE_CLI)
 * require additional account configuration. Contact DIDWW support to enable.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/voice-out-trunks.ts
 */
import { DidwwClient, Environment, DefaultDstAction, OnCliMismatchAction } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Create a voice out trunk
  const trunk = await client.voiceOutTrunks().create({
    name: 'My Outbound Trunk',
    allowedSipIps: ['0.0.0.0/0'],
    defaultDstAction: DefaultDstAction.ALLOW_ALL,
    onCliMismatchAction: OnCliMismatchAction.REJECT_CALL,
  });
  console.log(`Created voice out trunk: ${trunk.data.id}`);
  console.log(`  name: ${trunk.data.name}`);
  console.log(`  username: ${trunk.data.username}`);
  console.log(`  password: ${trunk.data.password}`);
  console.log(`  status: ${trunk.data.status}`);

  // List voice out trunks
  const trunks = await client.voiceOutTrunks().list();
  console.log(`\nAll voice out trunks (${trunks.data.length}):`);
  for (const t of trunks.data) {
    console.log(`  ${t.name} (${t.status})`);
  }

  // Update
  const updated = await client.voiceOutTrunks().update({
    id: trunk.data.id,
    name: 'Updated Outbound Trunk',
    allowedSipIps: ['10.0.0.0/8'],
  });
  console.log(`\nUpdated name: ${updated.data.name}`);
  console.log(`  allowedSipIps: ${updated.data.allowedSipIps.join(', ')}`);

  // Delete
  await client.voiceOutTrunks().remove(trunk.data.id);
  console.log('\nDeleted voice out trunk');
}

main().catch(console.error);
