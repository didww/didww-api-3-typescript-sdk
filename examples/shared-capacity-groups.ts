/**
 * Shared Capacity Groups: creates a group in a capacity pool, lists the groups,
 * updates the new one and deletes it, also when a step fails.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/shared-capacity-groups.ts
 */
import crypto from 'node:crypto';
import { DidwwClient, Environment, isIncluded, ref } from '../src/index.js';
import type { CapacityPool } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get a capacity pool
  const pools = await client.capacityPools().list();
  const pool = pools.data[0];
  if (!pool) {
    throw new Error('No capacity pools found');
  }
  console.log(`Using capacity pool: ${pool.name} (${pool.id})`);

  // Create a shared capacity group
  const suffix = crypto.randomBytes(4).toString('hex');
  const created = await client.sharedCapacityGroups().create({
    name: `My Channel Group ${suffix}`,
    meteredChannelsCount: 10,
    sharedChannelsCount: 1,
    externalReferenceId: `ts-scg-${suffix}`,
    capacityPool: ref('capacity_pools', pool.id),
  });
  console.log(`\nCreated: ${created.data.id}`);
  console.log(`  name: ${created.data.name}`);
  console.log(`  metered: ${created.data.meteredChannelsCount}`);
  console.log(`  shared: ${created.data.sharedChannelsCount}`);
  console.log(`  externalReferenceId: ${created.data.externalReferenceId}`);

  try {
    // List shared capacity groups with their capacity pool
    const groups = await client.sharedCapacityGroups().list({ include: 'capacity_pool' });
    console.log(`\nShared capacity groups (${groups.data.length}):`);
    for (const g of groups.data) {
      const poolName = isIncluded<CapacityPool>(g.capacityPool) ? g.capacityPool.name : 'unknown';
      console.log(
        `  ${g.name} (${g.id}) pool=${poolName} shared=${g.sharedChannelsCount} metered=${g.meteredChannelsCount}`,
      );
    }

    // Update the group: rename it and lower its metered channels
    const updated = await client.sharedCapacityGroups().update({
      id: created.data.id,
      name: `Updated Channel Group ${suffix}`,
      meteredChannelsCount: 5,
    });
    console.log(`\nUpdated: ${updated.data.name}, metered: ${updated.data.meteredChannelsCount}`);
  } finally {
    await client.sharedCapacityGroups().remove(created.data.id);
    console.log('Deleted shared capacity group');
  }
}

await main();
