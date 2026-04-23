/**
 * Voice Out Trunks: CRUD operations with polymorphic authentication_method.
 * Note: Voice Out Trunks and some OnCliMismatchAction values (e.g. REPLACE_CLI)
 * require additional account configuration. Contact DIDWW support to enable.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/voice-out-trunks.ts
 */
import {
  DidwwClient,
  Environment,
  DefaultDstAction,
  OnCliMismatchAction,
  credentialsAndIpAuthenticationMethod,
} from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Create a voice out trunk with credentials_and_ip authentication
  const suffix = Math.random().toString(36).slice(2, 10);
  const trunk = await client.voiceOutTrunks().create({
    name: `TS Outbound Trunk ${suffix}`,
    authenticationMethod: credentialsAndIpAuthenticationMethod({
      allowedSipIps: ['203.0.113.0/24'],
      techPrefix: '',
      // username and password are server-generated and returned in the response
    }),
    defaultDstAction: DefaultDstAction.ALLOW_ALL,
    onCliMismatchAction: OnCliMismatchAction.REJECT_CALL,
    externalReferenceId: `ts-example-${suffix}`,
  });
  console.log(`Created voice out trunk: ${trunk.data.id}`);
  console.log(`  name: ${trunk.data.name}`);
  console.log(`  status: ${trunk.data.status}`);
  console.log(`  authenticationMethod.type: ${trunk.data.authenticationMethod.type}`);
  console.log(`  externalReferenceId: ${trunk.data.externalReferenceId}`);
  console.log(`  emergencyEnableAll: ${trunk.data.emergencyEnableAll}`);
  console.log(`  rtpTimeout: ${trunk.data.rtpTimeout}`);

  // List voice out trunks
  const trunks = await client.voiceOutTrunks().list();
  console.log(`\nAll voice out trunks (${trunks.data.length}):`);
  for (const t of trunks.data) {
    console.log(`  ${t.name} (${t.status}) auth=${t.authenticationMethod.type}`);
  }

  // Update
  const updated = await client.voiceOutTrunks().update({
    id: trunk.data.id,
    name: 'Updated Outbound Trunk',
  });
  console.log(`\nUpdated name: ${updated.data.name}`);

  // Delete
  await client.voiceOutTrunks().remove(trunk.data.id);
  console.log('\nDeleted voice out trunk');
}

main().catch(console.error);
