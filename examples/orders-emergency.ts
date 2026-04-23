/**
 * Inspects Emergency orders (2026-04-16).
 *
 * Emergency orders are created server-side when an EmergencyCallingService
 * is activated or renewed -- customers cannot POST them directly. They
 * appear in GET /orders alongside DID/capacity/NANPA orders.
 *
 * Each Emergency order carries items of type "emergency_order_items":
 *   - qty, emergencyCallingServiceId (request)
 *   - nrc, mrc, proratedMrc, billedFrom, billedTo (response)
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/orders-emergency.ts
 */
import { DidwwClient, Environment, OrderItemType } from '../src/index.js';
import { isIncluded } from '../src/resources/base.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  console.log('=== All Orders (filtering for Emergency) ===');
  const orders = await client.orders().list();
  const emergencyOrders = orders.data.filter((o) => o.description === 'Emergency');
  console.log(`Found ${emergencyOrders.length} emergency orders out of ${orders.data.length} total`);

  for (const order of emergencyOrders.slice(0, 5)) {
    console.log(`\nOrder: ${order.id}`);
    console.log(`  Reference: ${order.reference}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Amount: ${order.amount}`);
    console.log(`  Created: ${order.createdAt}`);
    if (order.externalReferenceId) console.log(`  External Reference: ${order.externalReferenceId}`);

    order.items.forEach((item, i) => {
      if (item.type === OrderItemType.EMERGENCY) {
        console.log(`  Item #${i + 1} (emergency_order_items):`);
        console.log(`    Qty: ${item.qty}`);
        console.log(`    Emergency Calling Service ID: ${item.emergencyCallingServiceId}`);
        console.log(`    NRC: ${item.nrc}`);
        console.log(`    MRC: ${item.mrc}`);
        console.log(`    Prorated MRC: ${item.proratedMrc}`);
        console.log(`    Billed From: ${item.billedFrom}`);
        console.log(`    Billed To:   ${item.billedTo}`);
      }
    });
  }

  // Follow the link from an EmergencyCallingService to its order (if any)
  console.log('\n=== Emergency Calling Service -> Order ===');
  const services = await client.emergencyCallingServices().list({
    include: ['order'],
  });
  const svc = services.data[0];
  if (svc) {
    console.log(`ECS ${svc.id} (${svc.name})`);
    if (svc.order && isIncluded(svc.order)) {
      console.log(`  -> Order ${svc.order.id} -- status: ${svc.order.status}, amount: ${svc.order.amount}`);
    } else {
      console.log('  -> No order linked yet');
    }
  } else {
    console.log('No emergency_calling_services on this account');
  }
}

await main();
