import { DidwwClient, Environment, ref } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get a capacity pool
  const pools = await client.capacityPools().list();
  if (pools.data.length === 0) {
    console.log('No capacity pools found');
    return;
  }
  const pool = pools.data[0];
  console.log(`Using capacity pool: ${pool.name} (${pool.id})`);

  // Create a shared capacity group
  const suffix = Math.random().toString(36).substring(2, 10);
  const created = await client.sharedCapacityGroups().create({
    name: `My Channel Group ${suffix}`,
    meteredChannelsCount: 10,
    sharedChannelsCount: 1,
    capacityPool: ref('capacity_pools', pool.id),
  });
  console.log(`Created: ${created.data.id}`);
  console.log(`  name: ${created.data.name}`);
  console.log(`  metered: ${created.data.meteredChannelsCount}`);
  console.log(`  shared: ${created.data.sharedChannelsCount}`);
  if (created.data.externalReferenceId) {
    console.log(`  externalReferenceId: ${created.data.externalReferenceId}`);
  }

  // Clean up
  await client.sharedCapacityGroups().remove(created.data.id);
  console.log('Deleted shared capacity group');
}

main().catch(console.error);
