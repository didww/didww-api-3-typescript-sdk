import { DidwwClient, Environment, didOrderItem } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Find available DID groups
  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 1 },
  });

  if (groups.data.length === 0) {
    console.log('No DID groups found');
    return;
  }

  const group = groups.data[0];
  console.log(`DID Group: ${group.prefix}`);

  // Create an order
  const order = await client.orders().create({
    allow_back_ordering: true,
    items: [
      didOrderItem({
        sku_id: 'some-sku-id',
        qty: 1,
      }),
    ],
  });

  console.log(`Order created: ${order.data.id}`);
  console.log(`Status: ${order.data.status}`);
  console.log(`Amount: ${order.data.amount}`);
}

main().catch(console.error);
