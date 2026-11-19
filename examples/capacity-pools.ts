/**
 * Capacity Pools: lists pools with their shared capacity groups and qty-based
 * pricings, and finds one.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/capacity-pools.ts
 */
import { DidwwClient, Environment, isIncluded } from '../src/index.js';
import type { QtyBasedPricing, SharedCapacityGroup } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List capacity pools with included shared capacity groups and qty-based pricings
  const pools = await client.capacityPools().list({
    include: 'shared_capacity_groups,qty_based_pricings',
  });
  console.log(`Capacity pools (${pools.data.length}):`);
  for (const pool of pools.data) {
    console.log(`\n  ${pool.name} (${pool.id})`);
    console.log(`    totalChannelsCount: ${pool.totalChannelsCount}`);
    console.log(`    assignedChannelsCount: ${pool.assignedChannelsCount}`);
    console.log(`    renewDate: ${pool.renewDate}`);

    const groups = (pool.sharedCapacityGroups ?? []).filter((g): g is SharedCapacityGroup => isIncluded(g));
    if (groups.length > 0) {
      console.log(`    sharedCapacityGroups (${groups.length}):`);
      for (const g of groups) {
        console.log(`      ${g.name} shared=${g.sharedChannelsCount} metered=${g.meteredChannelsCount}`);
      }
    }

    const pricings = (pool.qtyBasedPricings ?? []).filter((p): p is QtyBasedPricing => isIncluded(p));
    if (pricings.length > 0) {
      console.log(`    qtyBasedPricings (${pricings.length}):`);
      for (const p of pricings) {
        console.log(`      qty=${p.qty} setup=${p.setupPrice} monthly=${p.monthlyPrice}`);
      }
    }
  }

  if (pools.data.length > 0) {
    // Find a single capacity pool
    const pool = await client.capacityPools().find(pools.data[0].id);
    console.log(`\nFound pool: ${pool.data.name}`);
  }
}

await main();
