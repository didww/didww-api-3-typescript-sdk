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
import type { SmsTrunk } from '../../src/resources/sms-trunk.js';
import type { SmsTrunkGroup } from '../../src/resources/sms-trunk-group.js';
import type { SmsHttpInConfiguration } from '../../src/nested/sms-trunk-configuration.js';
import { ref } from '../../src/resources/base.js';
import { DidwwClientError } from '../../src/errors.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('Dids', () => {
  describeOperationEnforcement({
    clientMethod: 'dids',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'dids',
  });
  it('lists DIDs', async () => {
    const client = setupClient('dids/list.yaml');
    const result = await client.dids().list({ include: 'order' });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('dids');
    expect(result.data[0].number).toBeDefined();
    const first = result.data[0];
    expect(first.order).toBeDefined();
    expect(isIncluded(first.order!)).toBe(true);
    expect((first.order as Order).reference).toBe('TZO-560180');
    expect(first.emergencyEnabled).toBe(false);
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
    expect((av as AddressVerification).status).toBe('approved');
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

    it('unassigns emergency_calling_service from Did', async () => {
      loadCassette('dids/update_unassign_ecs.yaml');
      const client = createTestClient();
      const result = await client.dids().update({
        id: '44957076-778a-4802-b60c-d22db0cda284',
        emergencyCallingService: null,
      });
      expect(result.data.id).toBe('44957076-778a-4802-b60c-d22db0cda284');
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

  describe('SMS routing', () => {
    const SMS_DID_ID = '9df99644-f1a5-4a3c-99a4-559d758eb96b';
    const SMS_TRUNK = ref('sms_trunks', '1a2b3c4d-0002-4a5b-8c6d-7e8f9a0b1c02');
    const SMS_TRUNK_GROUP = ref('sms_trunk_groups', '2b3c4d5e-0001-4b6c-9d7e-8f9a0b1c2d01');

    it('assigns an SMS trunk and clears the SMS trunk group', async () => {
      const client = setupClient('dids/update_assign_sms_trunk.yaml');
      const result = await client.dids().update({ id: SMS_DID_ID, smsTrunk: SMS_TRUNK });
      expect(result.data.id).toBe(SMS_DID_ID);
    });

    it('assigns an SMS trunk group and clears the SMS trunk', async () => {
      const client = setupClient('dids/update_assign_sms_trunk_group.yaml');
      const result = await client.dids().update({ id: SMS_DID_ID, smsTrunkGroup: SMS_TRUNK_GROUP });
      expect(result.data.id).toBe(SMS_DID_ID);
    });

    it('unassigns only the SMS trunk', async () => {
      const client = setupClient('dids/update_unassign_sms_trunk.yaml');
      const result = await client.dids().update({ id: SMS_DID_ID, smsTrunk: null });
      expect(result.data.id).toBe(SMS_DID_ID);
    });

    it('unassigns only the SMS trunk group', async () => {
      const client = setupClient('dids/update_unassign_sms_trunk_group.yaml');
      const result = await client.dids().update({ id: SMS_DID_ID, smsTrunkGroup: null });
      expect(result.data.id).toBe(SMS_DID_ID);
    });

    it('unassigns both', async () => {
      const client = setupClient('dids/update_unassign_sms.yaml');
      const result = await client.dids().update({ id: SMS_DID_ID, smsTrunk: null, smsTrunkGroup: null });
      expect(result.data.id).toBe(SMS_DID_ID);
    });

    it('rejects an SMS trunk and an SMS trunk group together before sending', async () => {
      const client = createTestClient();
      const error = await client
        .dids()
        .update({ id: SMS_DID_ID, smsTrunk: SMS_TRUNK, smsTrunkGroup: SMS_TRUNK_GROUP })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DidwwClientError);
      expect((error as Error).message).toContain('smsTrunk and smsTrunkGroup are mutually exclusive');
    });

    it('finds a DID with an included SMS trunk and a clean dirty state', async () => {
      const client = setupClient('dids/show_with_sms_trunk.yaml');
      const { data: did } = await client.dids().find(SMS_DID_ID, { include: 'sms_trunk' });
      expect(isIncluded(did.smsTrunk!)).toBe(true);
      const trunk = did.smsTrunk as SmsTrunk;
      expect((trunk.configuration as SmsHttpInConfiguration).headers).toEqual({ 'X-Source': 'didww' });
      expect(did.smsTrunkGroup).toBeUndefined();
      const serialized = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      expect(serialized.data.relationships).toBeUndefined();
    });

    it('finds a DID with an included SMS trunk group and its meta', async () => {
      const client = setupClient('dids/show_with_sms_trunk_group.yaml');
      const { data: did } = await client.dids().find(SMS_DID_ID, { include: 'sms_trunk_group' });
      expect(isIncluded(did.smsTrunkGroup!)).toBe(true);
      expect((did.smsTrunkGroup as SmsTrunkGroup).meta?.smsTrunksCount).toBe(2);
      expect(did.smsTrunk).toBeUndefined();
    });

    it('sends a new SMS trunk group of a loaded DID with the SMS trunk cleared', async () => {
      const client = setupClient('dids/show_with_sms_trunk.yaml');
      const { data: did } = await client.dids().find(SMS_DID_ID, { include: 'sms_trunk' });
      did.smsTrunkGroup = SMS_TRUNK_GROUP;
      const serialized = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      expect(serialized.data.relationships).toEqual({
        sms_trunk_group: { data: SMS_TRUNK_GROUP },
        sms_trunk: { data: null },
      });
    });

    it('rejects a spread copy of a loaded DID with an SMS trunk and a new SMS trunk group', async () => {
      const client = setupClient('dids/show_with_sms_trunk.yaml');
      const { data: did } = await client.dids().find(SMS_DID_ID, { include: 'sms_trunk' });
      const copy = { ...did, smsTrunkGroup: SMS_TRUNK_GROUP } as unknown as DidWrite & { id: string };
      expect(() => serializeForUpdate(DID_RESOURCE, copy)).toThrow(DidwwClientError);
    });
  });
});
