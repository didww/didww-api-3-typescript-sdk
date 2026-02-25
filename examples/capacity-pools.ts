/**
 * Capacity Pools: list and update.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/capacity-pools.ts
 */
import { DidwwClient, Environment, isIncluded } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List capacity pools with included shared capacity groups
  const pools = await client.capacityPools().list({
    include: 'shared_capacity_groups',
  });
  console.log(`Capacity pools (${pools.data.length}):`);
  for (const pool of pools.data) {
    console.log(`  ${pool.name} (${pool.id})`);
    console.log(`    totalChannelsCount: ${pool.totalChannelsCount}`);
    console.log(`    assignedChannelsCount: ${pool.assignedChannelsCount}`);
    const scgs = pool.sharedCapacityGroups || [];
    const scgNames = scgs.filter((g) => isIncluded(g)).map((g) => (g as { name: string }).name);
    if (scgNames.length > 0) {
      console.log(`    sharedCapacityGroups: [${scgNames.join(', ')}]`);
    }
  }

  if (pools.data.length > 0) {
    // Find a single capacity pool
    const pool = await client.capacityPools().find(pools.data[0].id);
    console.log(`\nFound pool: ${pool.data.name}`);
  }
}

main().catch(console.error);
