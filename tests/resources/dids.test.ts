import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import type { Order } from '../../src/resources/order.js';
import type { AddressVerification } from '../../src/resources/address-verification.js';
import type { DidGroup } from '../../src/resources/did-group.js';

describe('Dids', () => {
  afterEach(() => cleanupNock());

  it('lists DIDs', async () => {
    loadCassette('dids/list.yaml');
    const client = createTestClient();
    const result = await client.dids().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('dids');
    expect(result.data[0].number).toBeDefined();
    const first = result.data[0];
    expect(first.order).toBeDefined();
    expect(isIncluded(first.order!)).toBe(true);
    expect((first.order as Order).reference).toBe('TZO-560180');
  });

  it('finds a DID', async () => {
    loadCassette('dids/show.yaml');
    const client = createTestClient();
    const result = await client.dids().find('9df99644-f1a5-4a3c-99a4-559d758eb96b');
    expect(result.data.id).toBe('9df99644-f1a5-4a3c-99a4-559d758eb96b');
    expect(result.data.number).toBe('16091609123456797');
  });

  it('finds a DID with address_verification and did_group', async () => {
    loadCassette('dids/show_with_address_verification_and_did_group.yaml');
    const client = createTestClient();
    const result = await client.dids().find('21d0b02c-b556-4d3e-acbf-504b78295dbe', {
      include: ['address_verification', 'did_group'],
    });
    expect(result.data.number).toBe('61488943592');
    expect(result.data.blocked).toBe(false);
    const av = result.data.addressVerification;
    expect(av).toBeDefined();
    expect(isIncluded(av!)).toBe(true);
    expect((av as AddressVerification).status).toBe('Approved');
    expect((av as AddressVerification).reference).toBe('AHB-291174');
    const dg = result.data.didGroup;
    expect(dg).toBeDefined();
    expect(isIncluded(dg!)).toBe(true);
    expect((dg as DidGroup).prefix).toBe('4');
    expect((dg as DidGroup).areaName).toBe('Mobile');
  });
});
