import { DidwwClient, Environment, ref, reservationDidOrderItem } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get available DIDs with included DID group and SKUs
  const availableDids = await client.availableDids().list({
    include: 'did_group.stock_keeping_units',
  });
  if (availableDids.data.length === 0) {
    console.log('No available DIDs found');
    return;
  }

  const ad = availableDids.data[0];
  console.log(`Available DID: ${ad.number}`);

  // Resolve SKU from included DID group
  const didGroup = (ad as any).didGroup;
  const skus = didGroup?.stockKeepingUnits?.data || didGroup?.stockKeepingUnits || [];
  if (!Array.isArray(skus) || skus.length === 0) {
    console.log('No stockKeepingUnits found in included didGroup');
    return;
  }
  const skuId = skus[0].id;

  // Reserve the DID
  const reservation = await client.didReservations().create({
    description: 'Reserved via SDK',
    availableDid: ref('available_dids', ad.id),
  });
  console.log(`Reserved: ${reservation.data.id} expires=${reservation.data.expireAt}`);

  // Order the reserved DID
  const order = await client.orders().create({
    items: [
      reservationDidOrderItem({ skuId: skuId, didReservationId: reservation.data.id }),
    ],
  });
  console.log(`Order ${order.data.id} status=${order.data.status} items=${order.data.items.length}`);
}

main().catch(console.error);
