import { DidwwClient, Environment, didOrderItem } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Step 1: find the NANPA prefix by NPA/NXX (e.g. 201-221)
  const nanpaPrefixes = await client.nanpaPrefixes().list({
    filter: { npanxx: '201221' },
    page: { size: 1 },
  });

  if (nanpaPrefixes.data.length === 0) {
    console.log('NANPA prefix 201-221 not found');
    return;
  }

  const nanpaPrefix = nanpaPrefixes.data[0];
  console.log(`NANPA prefix: ${nanpaPrefix.id} NPA=${nanpaPrefix.npa} NXX=${nanpaPrefix.nxx}`);

  // Step 2: find a DID group for this prefix and load its SKUs
  const didGroups = await client.didGroups().list({
    filter: { 'nanpa_prefix.id': nanpaPrefix.id },
    include: 'stock_keeping_units',
    page: { size: 1 },
  });

  if (didGroups.data.length === 0) {
    console.log('No DID group found for this NANPA prefix');
    return;
  }

  const group = didGroups.data[0];
  const skus = group.stockKeepingUnits;
  if (!Array.isArray(skus) || skus.length === 0) {
    console.log('No SKUs found for this DID group');
    return;
  }

  const sku = skus[0];
  console.log(`DID group: ${group.id}  SKU: ${sku.id} (monthly=$${sku.monthlyPrice})`);

  // Step 3: create the order
  const order = await client.orders().create({
    allowBackOrdering: true,
    items: [
      didOrderItem({
        skuId: sku.id,
        nanpaPrefixId: nanpaPrefix.id,
        qty: 1,
      }),
    ],
  });

  console.log(
    `Order ${order.data.id} amount=${order.data.amount} status=${order.data.status} ref=${order.data.reference}`,
  );
}

main().catch(console.error);
