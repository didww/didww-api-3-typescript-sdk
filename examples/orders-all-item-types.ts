import {
  DidwwClient,
  Environment,
  ref,
  didOrderItem,
  availableDidOrderItem,
  reservationDidOrderItem,
} from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // --- Find available DIDs with their DID group and SKUs ---
  const availableDids = await client.availableDids().list({
    include: 'did_group.stock_keeping_units',
  });
  if (availableDids.data.length < 2) {
    console.log('Need at least 2 available DIDs for this example');
    return;
  }

  const ad1 = availableDids.data[0];
  const ad2 = availableDids.data[1];
  const skuId1 = getSku(ad1);
  const skuId2 = getSku(ad2);

  console.log(`Available DID 1: ${ad1.id} (${ad1.number}) - for AvailableDidOrderItem`);
  console.log(`Available DID 2: ${ad2.id} (${ad2.number}) - for reservation`);

  // --- Get a separate SKU for the DidOrderItem (by quantity) ---
  const didGroups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 10 },
  });
  let skuForQty: string | null = null;
  for (const dg of didGroups.data) {
    const skus = (dg as any).stock_keeping_units?.data || (dg as any).stock_keeping_units || [];
    if (Array.isArray(skus) && skus.length > 0) {
      skuForQty = skus[0].id;
      console.log(`SKU for qty order: ${skuForQty} (group=${dg.id})`);
      break;
    }
  }
  if (!skuForQty) {
    console.log('No DID group with stock_keeping_units found');
    return;
  }

  // --- Reserve the second available DID ---
  const reservation = await client.didReservations().create({
    description: 'Reserved for order example',
    available_did: ref('available_dids', ad2.id),
  });
  console.log(`Reservation: ${reservation.data.id}`);

  // --- Build order with all three item types ---
  const order = await client.orders().create({
    items: [
      didOrderItem({ sku_id: skuForQty, qty: 1 }),
      availableDidOrderItem({ sku_id: skuId1, available_did_id: ad1.id }),
      reservationDidOrderItem({ sku_id: skuId2, did_reservation_id: reservation.data.id }),
    ],
  });

  console.log(`\nOrder ID: ${order.data.id}`);
  console.log(`Amount: ${order.data.amount}`);
  console.log(`Status: ${order.data.status}`);
  console.log(`Created at: ${order.data.created_at}`);
  console.log(`Reference: ${order.data.reference}`);
  console.log(`Items count: ${order.data.items.length}`);
  for (let i = 0; i < order.data.items.length; i++) {
    console.log(`  Item ${i + 1}: type=${order.data.items[i].type}`);
  }

  // --- Fetch DIDs that belong to this order ---
  const dids = await client.dids().list({
    filter: { 'order.id': order.data.id },
  });
  console.log(`\nDIDs in order (${dids.data.length}):`);
  for (const did of dids.data) {
    console.log(`  ${did.id} | ${did.number} | capacity_limit=${did.capacity_limit}`);
  }
}

function getSku(ad: any): string {
  const didGroup = (ad as any).did_group;
  const skus = didGroup?.stock_keeping_units?.data || didGroup?.stock_keeping_units || [];
  if (!Array.isArray(skus) || skus.length === 0) {
    throw new Error(`No stock_keeping_units for available DID ${ad.id}`);
  }
  return skus[0].id;
}

main().catch(console.error);
