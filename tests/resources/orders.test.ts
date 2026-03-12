import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';

describe('Orders', () => {

  it('finds an order', async () => {
    loadCassette('orders/show.yaml');
    const client = createTestClient();
    const result = await client.orders().find('9df11dac-9d83-448c-8866-19c998be33db');
    expect(result.data.id).toBe('9df11dac-9d83-448c-8866-19c998be33db');
    expect(result.data.status).toBe('Completed');
    expect(result.data.amount).toBe('25.07');
    expect(result.data.description).toBe('Payment processing fee');
    expect(result.data.reference).toBe('SPT-474057');
    expect(result.data.items.length).toBeGreaterThan(0);
  });

  it('creates an order', async () => {
    loadCassette('orders/create.yaml');
    const client = createTestClient();
    const result = await client.orders().create({
      allowBackOrdering: true,
      items: [
        { type: 'did_order_items', skuId: 'acc46374-0b34-4912-9f67-8340339db1e5', qty: 2 },
        { type: 'did_order_items', skuId: 'f36d2812-2195-4385-85e8-e59c3484a8bc', qty: 1 },
      ],
    });
    expect(result.data.id).toBe('5da18706-be9f-49b0-aeec-0480aacd49ad');
    expect(result.data.status).toBe('Pending');
    expect(result.data.description).toBe('DID');
    expect(result.data.items.length).toBe(2);
  });

  it('creates an order with billing_cycles_count', async () => {
    loadCassette('orders/create_5.yaml');
    const client = createTestClient();
    const result = await client.orders().create({
      allowBackOrdering: true,
      items: [
        { type: 'did_order_items', skuId: 'f36d2812-2195-4385-85e8-e59c3484a8bc', qty: 1, billingCyclesCount: 5 },
      ],
    });
    expect(result.data.id).toBe('9b9f2121-8d9e-4aa8-9754-dbaf6f695fd6');
    expect(result.data.status).toBe('Pending');
    expect(result.data.items.length).toBe(1);
  });

  it('creates an order with available_did', async () => {
    loadCassette('orders/create_3.yaml');
    const client = createTestClient();
    const result = await client.orders().create({
      items: [
        {
          type: 'did_order_items',
          skuId: 'acc46374-0b34-4912-9f67-8340339db1e5',
          availableDidId: 'c43441e3-82d4-4d84-93e2-80998576c1ce',
        },
      ],
    });
    expect(result.data.id).toBe('9b9f2121-8d9e-4aa8-9754-dbaf6f695fd6');
    expect(result.data.status).toBe('Pending');
    expect(result.data.items.length).toBe(1);
  });

  it('creates an order with reservation', async () => {
    loadCassette('orders/create_1.yaml');
    const client = createTestClient();
    const result = await client.orders().create({
      items: [
        {
          type: 'did_order_items',
          skuId: '32840f64-5c3f-4278-8c8d-887fbe2f03f4',
          didReservationId: 'e3ed9f97-1058-430c-9134-38f1c614ee9f',
        },
      ],
    });
    expect(result.data.id).toBe('a9a7ff2d-d634-4545-bf28-dfda92d1c723');
    expect(result.data.status).toBe('Pending');
    expect(result.data.items.length).toBe(1);
  });

  it('creates a capacity order', async () => {
    loadCassette('orders/create_2.yaml');
    const client = createTestClient();
    const result = await client.orders().create({
      items: [{ type: 'capacity_order_items', capacityPoolId: 'b7522a31-4bf3-4c23-81e8-e7a14b23663f', qty: 1 }],
    });
    expect(result.data.id).toBe('68a46dd5-d405-4283-b7a5-62503267e9f8');
    expect(result.data.status).toBe('Completed');
    expect(result.data.description).toBe('Capacity');
    expect(result.data.items.length).toBe(1);
  });

  it('creates an order with nanpa_prefix', async () => {
    loadCassette('orders/create_6.yaml');
    const client = createTestClient();
    const result = await client.orders().create({
      allowBackOrdering: true,
      items: [
        {
          type: 'did_order_items',
          skuId: 'fe77889c-f05a-40ad-a845-96aca3c28054',
          nanpaPrefixId: 'eeed293b-f3d8-4ef8-91ef-1b077d174b3b',
          qty: 1,
        },
      ],
    });
    expect(result.data.id).toBe('c617f0ff-f819-477f-a17b-a8d248c4443e');
    expect(result.data.status).toBe('Pending');
    expect(result.data.items.length).toBe(1);
  });

  it('creates an order with callback', async () => {
    loadCassette('orders_with_callback/create.yaml');
    const client = createTestClient();
    const result = await client.orders().create({
      allowBackOrdering: true,
      callbackUrl: 'https://example.com/callback',
      callbackMethod: 'POST',
      items: [{ type: 'did_order_items', skuId: 'f36d2812-2195-4385-85e8-e59c3484a8bc', qty: 1 }],
    });
    expect(result.data.id).toBe('5da18706-be9f-49b0-aeec-0480aacd49ad');
    expect(result.data.status).toBe('Pending');
    expect(result.data.callbackUrl).toBe('https://example.com/callback');
    expect(result.data.callbackMethod).toBe('POST');
    expect(result.data.items.length).toBe(1);
  });
});
