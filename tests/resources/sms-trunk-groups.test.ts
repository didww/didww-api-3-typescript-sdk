import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import { DidwwApiError } from '../../src/errors.js';
import { serializeForCreate } from '../../src/serializer.js';
import { SMS_TRUNK_GROUP_RESOURCE } from '../../src/resources/sms-trunk-group.js';
import type { SmsTrunk } from '../../src/resources/sms-trunk.js';
import type { Did } from '../../src/resources/did.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

const GROUP_ID = '2b3c4d5e-0001-4b6c-9d7e-8f9a0b1c2d01';
const HTTP_IN_ID = '1a2b3c4d-0002-4a5b-8c6d-7e8f9a0b1c02';
const SMPP_SMSC_ID = '1a2b3c4d-0005-4a5b-8c6d-7e8f9a0b1c05';

describe('SmsTrunkGroups', () => {
  describeOperationEnforcement({
    clientMethod: 'smsTrunkGroups',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'sms_trunk_groups',
  });

  it('lists SMS trunk groups with their trunk count', async () => {
    const client = setupClient('sms_trunk_groups/list.yaml');
    const result = await client.smsTrunkGroups().list();
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('Inbound SMS');
    expect(result.data[0].externalReferenceId).toBeNull();
    expect(result.data[0].meta?.smsTrunksCount).toBe(2);
    expect(result.data[1].meta?.smsTrunksCount).toBe(0);
  });

  it('finds an SMS trunk group with included trunks', async () => {
    const client = setupClient('sms_trunk_groups/show_with_sms_trunks.yaml');
    const result = await client.smsTrunkGroups().find(GROUP_ID, { include: 'sms_trunks' });
    const trunks = result.data.smsTrunks!;
    expect(trunks.map((t) => t.id)).toEqual([HTTP_IN_ID, SMPP_SMSC_ID]);
    expect(isIncluded(trunks[0])).toBe(true);
    expect((trunks[0] as SmsTrunk).configuration.type).toBe('http_in');
  });

  it('raises DidwwApiError for a missing SMS trunk group', async () => {
    const client = setupClient('sms_trunk_groups/show_not_found.yaml');
    const error = await client
      .smsTrunkGroups()
      .find(GROUP_ID)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(404);
  });

  it('creates an SMS trunk group', async () => {
    const client = setupClient('sms_trunk_groups/create.yaml');
    const result = await client.smsTrunkGroups().create({
      name: 'Inbound SMS',
      smsTrunks: [ref('sms_trunks', HTTP_IN_ID)],
    });
    expect(result.data.id).toBe(GROUP_ID);
    expect(result.data.meta?.smsTrunksCount).toBe(1);
  });

  it('updates the external reference id', async () => {
    const client = setupClient('sms_trunk_groups/update_external_reference_id.yaml');
    const result = await client.smsTrunkGroups().update({ id: GROUP_ID, externalReferenceId: 'updated-ext-ref-99' });
    expect(result.data.externalReferenceId).toBe('updated-ext-ref-99');
  });

  it('replaces the trunks', async () => {
    const client = setupClient('sms_trunk_groups/update_sms_trunks.yaml');
    const result = await client.smsTrunkGroups().update({
      id: GROUP_ID,
      smsTrunks: [ref('sms_trunks', HTTP_IN_ID), ref('sms_trunks', SMPP_SMSC_ID)],
    });
    expect(result.data.meta?.smsTrunksCount).toBe(2);
  });

  it('empties the group with an empty list', async () => {
    const client = setupClient('sms_trunk_groups/update_clear_sms_trunks.yaml');
    const result = await client.smsTrunkGroups().update({ id: GROUP_ID, smsTrunks: [] });
    expect(result.data.smsTrunks).toEqual([]);
    expect(result.data.meta?.smsTrunksCount).toBe(0);
  });

  it('empties the group with null', async () => {
    const client = setupClient('sms_trunk_groups/update_clear_sms_trunks.yaml');
    const result = await client.smsTrunkGroups().update({ id: GROUP_ID, smsTrunks: null });
    expect(result.data.meta?.smsTrunksCount).toBe(0);
  });

  it('sends a trunk pushed into the loaded list', async () => {
    const client = setupClient('sms_trunk_groups/update_loaded_push_sms_trunk.yaml');
    const { data: group } = await client.smsTrunkGroups().find(GROUP_ID, { include: 'sms_trunks' });
    expect(group.meta?.smsTrunksCount).toBe(2);
    group.smsTrunks!.push(ref('sms_trunks', '1a2b3c4d-0004-4a5b-8c6d-7e8f9a0b1c04'));
    const result = await client.smsTrunkGroups().update(group);
    expect(result.data.id).toBe(GROUP_ID);
    expect(result.data.meta?.smsTrunksCount).toBe(3);
  });

  it('never sends the read-only incoming DIDs back', async () => {
    const client = setupClient('sms_trunk_groups/update_loaded_with_incoming_dids.yaml');
    const { data: group } = await client.smsTrunkGroups().find(GROUP_ID, { include: 'incoming_dids' });
    expect(isIncluded(group.incomingDids![0])).toBe(true);
    expect((group.incomingDids![0] as Did).number).toBe('16091609123456797');
    group.name = 'Renamed';
    const result = await client.smsTrunkGroups().update(group);
    expect(result.data.id).toBe(GROUP_ID);
    expect(result.data.name).toBe('Renamed');

    const created = serializeForCreate(SMS_TRUNK_GROUP_RESOURCE, group).data;
    expect(created.relationships).toBeUndefined();
    expect(created.attributes).toEqual({ name: 'Renamed', external_reference_id: null });
  });

  it('deletes an SMS trunk group', async () => {
    const client = setupClient('sms_trunk_groups/delete.yaml');
    await expect(client.smsTrunkGroups().remove(GROUP_ID)).resolves.toBeUndefined();
  });

  it('raises DidwwApiError when the group is in use', async () => {
    const client = setupClient('sms_trunk_groups/delete_error.yaml');
    const error = await client
      .smsTrunkGroups()
      .remove(GROUP_ID)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(422);
  });
});
