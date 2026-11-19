/**
 * Orders: lists recent orders, orders a DID by SKU and cancels that order
 * (remove() sends DELETE /orders/{id}, which cancels it).
 *
 * external_reference_id is a customer-supplied tag (max 100 chars).
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/orders.ts
 */
import crypto from 'node:crypto';
import { DidwwClient, Environment, didOrderItem, isIncluded } from '../src/index.js';
import type { DidGroup, StockKeepingUnit } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List the most recent orders
  console.log('=== Recent Orders ===');
  const orders = await client.orders().list({ sort: '-created_at', page: { number: 1, size: 5 } });
  console.log(`Showing ${orders.data.length} orders`);
  for (const order of orders.data) {
    console.log(`Order ${order.id}: ${order.status} ($${order.amount}) ${order.createdAt}`);
    if (order.items.length > 0) console.log(`  Items: ${order.items.map((item) => item.type).join(', ')}`);
    if (order.externalReferenceId) console.log(`  External reference: ${order.externalReferenceId}`);
  }

  // Order a DID by SKU, from a DID group that has numbers in stock: the DID group of an available DID
  console.log('\n=== Creating DID Order ===');
  const available = await client.availableDids().list({
    include: 'did_group.stock_keeping_units',
    page: { number: 1, size: 1 },
  });
  const group = available.data[0]?.didGroup;
  if (!isIncluded<DidGroup>(group)) {
    throw new Error('No available DID found');
  }
  const sku = (group.stockKeepingUnits ?? []).find((s): s is StockKeepingUnit => isIncluded(s));
  if (!sku) {
    throw new Error(`DID group ${group.areaName} has no stock keeping units`);
  }
  console.log(`DID group: ${group.prefix} ${group.areaName}, SKU ${sku.id} ($${sku.monthlyPrice}/mo)`);

  const suffix = crypto.randomBytes(4).toString('hex');
  const created = await client.orders().create({
    allowBackOrdering: false,
    items: [didOrderItem({ skuId: sku.id, qty: 1 })],
    externalReferenceId: `ts-order-${suffix}`,
  });
  console.log(`Created order: ${created.data.id} - ${created.data.status}`);
  console.log(`  Amount: ${created.data.amount}`);
  console.log(`  Reference: ${created.data.reference}`);
  console.log(`  External reference: ${created.data.externalReferenceId}`);

  // Cancel the order (delete it)
  console.log('\n=== Cancelling Order ===');
  await client.orders().remove(created.data.id);
  console.log('Order canceled');
}

await main();
