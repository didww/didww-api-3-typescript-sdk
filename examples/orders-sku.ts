import { DidwwClient, Environment, didOrderItem } from '../src/index.js';
import crypto from 'node:crypto';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Find available DID groups with stock keeping units
  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 5 },
  });

  if (groups.data.length === 0) {
    console.log('No DID groups found');
    return;
  }

  // Find a group with SKUs
  let selectedGroup = null;
  let sku: Record<string, unknown> | null = null;
  for (const group of groups.data) {
    const skus = group.stockKeepingUnits;
    if (Array.isArray(skus) && skus.length > 0) {
      selectedGroup = group;
      sku = skus[0];
      console.log(`DID Group: ${group.prefix} - ${group.areaName}`);
      console.log(`  SKU: ${sku.id} (${sku.channelsIncludedCount} channels, $${sku.monthlyPrice}/mo)`);
      break;
    }
  }

  if (!selectedGroup || !sku) {
    console.log('No DID groups with SKUs found in the first page');
    return;
  }

  // Create an order (2026-04-16 external_reference_id -- customer-supplied tag, max 100 chars)
  const suffix = crypto.randomBytes(4).toString('hex');
  const order = await client.orders().create({
    allowBackOrdering: true,
    items: [
      didOrderItem({
        skuId: sku.id,
        qty: 1,
      }),
    ],
    externalReferenceId: `ts-order-${suffix}`,
  });

  console.log(`\nOrder created: ${order.data.id}`);
  console.log(`Status: ${order.data.status}`);
  console.log(`Amount: $${order.data.amount}`);
  console.log(`Reference: ${order.data.reference}`);
  console.log(`External Reference: ${order.data.externalReferenceId}`);
}

main().catch(console.error);
