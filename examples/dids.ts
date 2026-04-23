import { DidwwClient, Environment, ref } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get last ordered DID (include 2026-04-16 emergency relationships)
  const dids = await client.dids().list({
    sort: '-created_at',
    page: { number: 1, size: 1 },
    include: ['identity', 'emergency_calling_service', 'emergency_verification'],
  });
  if (dids.data.length === 0) {
    console.log('No DIDs found. Run an order example first.');
    return;
  }
  const did = dids.data[0];
  console.log(`DID: ${did.number} (${did.id})`);
  console.log(`  Emergency enabled: ${did.emergencyEnabled}`);
  if (did.emergencyCallingService) console.log(`  Emergency Calling Service: ${did.emergencyCallingService.id}`);
  if (did.emergencyVerification) console.log(`  Emergency Verification:    ${did.emergencyVerification.id}`);
  if (did.identity) console.log(`  Identity: ${did.identity.id}`);

  // Get last SIP trunk
  const trunks = await client.voiceInTrunks().list({
    sort: '-created_at',
    filter: { 'configuration.type': 'sip_configurations' },
  });
  if (trunks.data.length > 0) {
    const trunk = trunks.data[0];

    // Assign trunk to DID
    const updated = await client.dids().update({
      id: did.id,
      voiceInTrunk: ref('voice_in_trunks', trunk.id),
    });
    console.log(`Assigned trunk ${trunk.id} to DID`);
  }

  // Assign capacity pool and update attributes
  const pools = await client.capacityPools().list();
  if (pools.data.length > 0) {
    const pool = pools.data[0];

    const saved = await client.dids().update({
      id: did.id,
      capacityPool: ref('capacity_pools', pool.id),
      dedicatedChannelsCount: 1,
      capacityLimit: 5,
      description: 'Updated via SDK',
    });
    console.log(`DID ${saved.data.id}`);
    console.log(`  description: ${saved.data.description}`);
    console.log(`  capacityLimit: ${saved.data.capacityLimit}`);
    console.log(`  dedicatedChannels: ${saved.data.dedicatedChannelsCount}`);
  }
}

main().catch(console.error);
