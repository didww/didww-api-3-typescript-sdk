import { DidwwClient, Environment, capacityOrderItem } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get capacity pools
  const pools = await client.capacityPools().list();
  if (pools.data.length === 0) {
    console.log('No capacity pools found');
    return;
  }

  const pool = pools.data[0];
  console.log(`Capacity pool: ${pool.name} (${pool.id})`);

  // Purchase capacity
  const order = await client.orders().create({
    items: [
      capacityOrderItem({ capacityPoolId: pool.id, qty: 1 }),
    ],
  });
  console.log(`Order ${order.data.id} status=${order.data.status} items=${order.data.items.length}`);
}

main().catch(console.error);
