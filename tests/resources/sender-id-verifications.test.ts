import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import { DidwwApiError } from '../../src/errors.js';
import { SenderIdVerificationStatus, SenderType } from '../../src/enums.js';
import type { SmsTrunk } from '../../src/resources/sms-trunk.js';
import type { Country } from '../../src/resources/country.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

const SIV_ID = 'e5a4e2f1-3b26-4a5c-9a0a-2f7c1f3e8d10';
const HTTP_OUT_ID = '1a2b3c4d-0003-4a5b-8c6d-7e8f9a0b1c03';

describe('SenderIdVerifications', () => {
  describeOperationEnforcement({
    clientMethod: 'senderIdVerifications',
    allowedOperations: ['list', 'find', 'update'],
    resourceType: 'sender_id_verifications',
  });

  it('lists sender ID verifications', async () => {
    const client = setupClient('sender_id_verifications/list.yaml');
    const result = await client.senderIdVerifications().list();
    const [active, changes] = result.data;
    expect(active.name).toBe('ACME alerts');
    expect(active.status).toBe(SenderIdVerificationStatus.ACTIVE);
    expect(active.senderType).toBe(SenderType.LONG_CODE);
    expect(active.senderIds).toEqual(['12125550100', '12125550101']);
    expect(active.reference).toBe('SID-1234');
    expect(active.renewDate).toBe('2026-11-22');
    expect(active.activatedAt).toBe('2026-10-03T12:30:00.000Z');
    expect(active.closedAt).toBeNull();
    expect(active.rejectReasons).toBeNull();
    expect(active.meta?.setupPrice).toBe('10.0');
    expect(active.meta?.monthlyPrice).toBe('15.0');
    expect(changes.status).toBe(SenderIdVerificationStatus.CHANGES_REQUIRED);
    expect(changes.senderType).toBe(SenderType.ALPHANUMERIC);
    expect(changes.renewDate).toBeNull();
    expect(changes.rejectReasons).toEqual(['Company documents are missing']);
    expect(changes.rejectComment).toBe('Upload the certificate of incorporation.');
  });

  it('finds a sender ID verification with its included trunk and the trunk meta', async () => {
    const client = setupClient('sender_id_verifications/show_with_sms_trunk.yaml');
    const result = await client.senderIdVerifications().find(SIV_ID, { include: 'sms_trunk' });
    const trunk = result.data.smsTrunk!;
    expect(isIncluded(trunk)).toBe(true);
    expect((trunk as SmsTrunk).configuration.type).toBe('http_out');
    expect((trunk as SmsTrunk).meta?.host).toBe('https://sms-out.example.com/outbound_messages');
  });

  it('updates the name', async () => {
    const client = setupClient('sender_id_verifications/update_name.yaml');
    const result = await client.senderIdVerifications().update({ id: SIV_ID, name: 'ACME notifications' });
    expect(result.data.name).toBe('ACME notifications');
    expect(result.data.meta?.setupPrice).toBe('10.0');
  });

  it('assigns an SMS trunk', async () => {
    const client = setupClient('sender_id_verifications/assign_sms_trunk.yaml');
    const result = await client
      .senderIdVerifications()
      .update({ id: SIV_ID, smsTrunk: ref('sms_trunks', HTTP_OUT_ID) });
    expect(result.data.id).toBe(SIV_ID);
  });

  it('unassigns the SMS trunk', async () => {
    const client = setupClient('sender_id_verifications/unassign_sms_trunk.yaml');
    const result = await client.senderIdVerifications().update({ id: SIV_ID, smsTrunk: null });
    expect(result.data.id).toBe(SIV_ID);
  });

  it('raises DidwwApiError for a closed verification', async () => {
    const client = setupClient('sender_id_verifications/update_closed_error.yaml');
    const error = await client
      .senderIdVerifications()
      .update({ id: SIV_ID, name: 'ACME notifications' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(422);
  });

  it('never sends the read-only relationships back', async () => {
    const client = setupClient('sender_id_verifications/update_loaded_with_read_only_relationships.yaml');
    const { data: siv } = await client
      .senderIdVerifications()
      .find(SIV_ID, { include: ['countries', 'dids', 'order', 'identity', 'address'] });
    expect((siv.countries![0] as Country).iso).toBe('US');
    expect(siv.order?.id).toBe('9df11dac-9d83-448c-8866-19c998be33db');
    siv.name = 'ACME notifications';
    const result = await client.senderIdVerifications().update(siv);
    expect(result.data.name).toBe('ACME notifications');
  });
});
