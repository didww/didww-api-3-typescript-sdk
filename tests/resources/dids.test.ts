import { describe, it, expect } from 'vitest';
import { createTestClient, setupClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import { serializeForUpdate } from '../../src/serializer.js';
import { DID_RESOURCE } from '../../src/resources/did.js';
import type { DidWrite } from '../../src/resources/did.js';
import type { Order } from '../../src/resources/order.js';
import type { AddressVerification } from '../../src/resources/address-verification.js';
import type { DidGroup } from '../../src/resources/did-group.js';
import type { VoiceInTrunk } from '../../src/resources/voice-in-trunk.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('Dids', () => {
  describeOperationEnforcement({
    clientMethod: 'dids',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'dids',
  });
  it('lists DIDs', async () => {
    const client = setupClient('dids/list.yaml');
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
    const client = setupClient('dids/show.yaml');
    const result = await client.dids().find('9df99644-f1a5-4a3c-99a4-559d758eb96b');
    expect(result.data.id).toBe('9df99644-f1a5-4a3c-99a4-559d758eb96b');
    expect(result.data.number).toBe('16091609123456797');
  });

  it('updates a DID', async () => {
    const client = setupClient('dids/update_1.yaml');
    const result = await client.dids().update({
      id: '9df99644-f1a5-4a3c-99a4-559d758eb96b',
      description: 'something',
    });
    expect(result.data.id).toBe('9df99644-f1a5-4a3c-99a4-559d758eb96b');
    expect(result.data.description).toBe('something');
    expect(result.data.blocked).toBe(false);
    expect(result.data.terminated).toBe(false);
  });

  it('updates a DID to terminated state', async () => {
    const client = setupClient('dids/update_7.yaml');
    const result = await client.dids().update({
      id: '9df99644-f1a5-4a3c-99a4-559d758eb96b',
      terminated: true,
    });
    expect(result.data.blocked).toBe(true);
    expect(result.data.terminated).toBe(true);
    expect(result.data.billingCyclesCount).toBe(0);
  });

  it('finds a DID with address_verification and did_group', async () => {
    const client = setupClient('dids/show_with_address_verification_and_did_group.yaml');
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

  describe('Dirty tracking - integration tests', () => {
    const DID_ID = '9df99644-f1a5-4a3c-99a4-559d758eb96b';
    const TRUNK_ID = 'a27e7cc1-cbb1-4295-8e63-e8e1cbb57630';

    it('update built single attribute', async () => {
      loadCassette('dids/update_built_single_attr.yaml');
      const client = createTestClient();
      const result = await client.dids().update({
        id: DID_ID,
        capacityLimit: 10,
      });
      expect(result.data.id).toBe(DID_ID);
    });

    it('update clear description', async () => {
      loadCassette('dids/update_clear_description.yaml');
      const client = createTestClient();
      const result = await client.dids().update({
        id: DID_ID,
        description: null,
      });
      expect(result.data.id).toBe(DID_ID);
    });

    it('update terminated', async () => {
      loadCassette('dids/update_terminated.yaml');
      const client = createTestClient();
      const result = await client.dids().update({
        id: DID_ID,
        terminated: true,
      });
      expect(result.data.terminated).toBe(true);
      expect(result.data.blocked).toBe(true);
    });

    it('update set voice in trunk', async () => {
      loadCassette('dids/update_set_voice_in_trunk.yaml');
      const client = createTestClient();
      const result = await client.dids().update({
        id: DID_ID,
        voiceInTrunk: { id: TRUNK_ID, type: 'voice_in_trunks' },
      });
      expect(result.data.id).toBe(DID_ID);
    });

    it('update from loaded', async () => {
      loadCassette('dids/update_from_loaded.yaml');
      const client = createTestClient();
      const loaded = await client.dids().find(DID_ID);
      const did = loaded.data;
      (did as Record<string, unknown>).description = 'patched';
      const result = await client.dids().update(did as unknown as DidWrite & { id: string });
      expect(result.data.description).toBe('patched');
    });

    it('update from loaded set voice in trunk', async () => {
      loadCassette('dids/update_from_loaded_set_voice_in_trunk.yaml');
      const client = createTestClient();
      const loaded = await client.dids().find(DID_ID);
      const did = loaded.data;
      (did as Record<string, unknown>).voiceInTrunk = { id: TRUNK_ID, type: 'voice_in_trunks' };
      const result = await client.dids().update(did as unknown as DidWrite & { id: string });
      expect(result.data.id).toBe(DID_ID);
    });

    it('find with included has clean dirty state', async () => {
      loadCassette('dids/show_with_included_trunk.yaml');
      const client = createTestClient();
      const result = await client.dids().find(DID_ID, { include: ['voice_in_trunk'] });
      const did = result.data;
      expect(did.voiceInTrunk).toBeDefined();
      expect(isIncluded(did.voiceInTrunk!)).toBe(true);
      expect((did.voiceInTrunk as VoiceInTrunk).name).toBe('Test Trunk');
      // Verify no dirty fields when updating unchanged
      const serialized = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      expect(serialized.data.attributes).toBeUndefined();
      expect(serialized.data.relationships).toBeUndefined();
    });
  });
});
