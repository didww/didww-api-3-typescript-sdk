import { DidwwClient, Environment, didOrderItem } from '../src/index.js';

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
  let sku: any = null;
  for (const group of groups.data) {
    const skuRel = (group as any).stock_keeping_units;
    const skus = skuRel?.data || (Array.isArray(skuRel) ? skuRel : null);
    if (Array.isArray(skus) && skus.length > 0) {
      selectedGroup = group;
      sku = skus[0];
      console.log(`DID Group: ${group.prefix} - ${group.area_name}`);
      console.log(`  SKU: ${sku.id} (${sku.channels_included_count} channels, $${sku.monthly_price}/mo)`);
      break;
    }
  }

  if (!selectedGroup || !sku) {
    console.log('No DID groups with SKUs found in the first page');
    return;
  }

  // Create an order
  const order = await client.orders().create({
    allow_back_ordering: true,
    items: [
      didOrderItem({
        sku_id: sku.id,
        qty: 1,
      }),
    ],
  });

  console.log(`\nOrder created: ${order.data.id}`);
  console.log(`Status: ${order.data.status}`);
  console.log(`Amount: $${order.data.amount}`);
  console.log(`Reference: ${order.data.reference}`);
}

main().catch(console.error);
