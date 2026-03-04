import { describe, it, expect } from 'vitest';
import { deserialize, serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { DID_RESOURCE } from '../src/resources/did.js';
import { VOICE_IN_TRUNK_GROUP_RESOURCE } from '../src/resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_RESOURCE } from '../src/resources/voice-out-trunk.js';
import type { Did, DidWrite } from '../src/resources/did.js';
import type { VoiceInTrunkGroup, VoiceInTrunkGroupWrite } from '../src/resources/voice-in-trunk-group.js';

describe('Dirty tracking - PATCH sends only changed fields', () => {
  describe('Scenario 1: build(id), set one attribute, update', () => {
    it('sends only the set attribute (+ id/type wrapper)', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        description: 'updated description',
      });
      expect(result.data.id).toBe('did-1');
      expect(result.data.type).toBe('dids');
      expect(result.data.attributes.description).toBe('updated description');
      // No other attributes should be present
      const attrKeys = Object.keys(result.data.attributes);
      expect(attrKeys).toEqual(['description']);
    });

    it('sends only the set relationship (+ auto-nullified exclusive)', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        voiceInTrunk: { id: 'trunk-1', type: 'voice_in_trunks' },
      });
      expect(result.data.id).toBe('did-1');
      // No attributes when only relationships are set
      expect(result.data.attributes).toBeUndefined();
      expect(result.data.relationships?.voice_in_trunk).toEqual({
        data: { id: 'trunk-1', type: 'voice_in_trunks' },
      });
      // voiceInTrunkGroup should be auto-nullified by exclusive relationship logic
      expect(result.data.relationships?.voice_in_trunk_group).toEqual({
        data: null,
      });
    });

    it('sends multiple set fields but no unset fields', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        description: 'test',
        capacityLimit: 10,
      });
      const attrKeys = Object.keys(result.data.attributes);
      expect(attrKeys).toEqual(expect.arrayContaining(['description', 'capacity_limit']));
      expect(attrKeys).toHaveLength(2);
    });

    it('sends only changed field for resource without serializeCustom', () => {
      const result = serializeForUpdate(VOICE_IN_TRUNK_GROUP_RESOURCE, {
        id: 'group-1',
        name: 'Updated Group',
      });
      expect(result.data.id).toBe('group-1');
      expect(result.data.attributes.name).toBe('Updated Group');
      expect(result.data.attributes?.capacity_limit).toBeUndefined();
    });
  });

  describe('Scenario 2: set attribute to null, update → explicit null sent', () => {
    it('sends explicit null for attribute set to null', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        description: null,
      });
      expect(result.data.attributes.description).toBeNull();
    });

    it('sends explicit null for relationship set to null', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        voiceInTrunk: null,
      });
      expect(result.data.relationships?.voice_in_trunk).toEqual({ data: null });
    });

    it('sends explicit null for nullable relationship on resource without serializeCustom', () => {
      const result = serializeForUpdate(VOICE_OUT_TRUNK_RESOURCE, {
        id: 'trunk-1',
        defaultDid: null,
      });
      expect(result.data.relationships?.default_did).toEqual({ data: null });
      // Only defaultDid should be sent, no other fields
      expect(result.data.attributes?.name).toBeUndefined();
    });
  });

  describe('Scenario 3: load from API (deserialize), set one field, update → only changed field sent', () => {
    function deserializeDid(overrides: Record<string, unknown> = {}): Did {
      const body = {
        data: {
          id: 'did-1',
          type: 'dids',
          attributes: {
            number: '+1234567890',
            blocked: false,
            awaiting_registration: false,
            terminated: false,
            description: 'original description',
            capacity_limit: 2,
            channels_included_count: 1,
            dedicated_channels_count: 0,
            billing_cycles_count: 1,
            created_at: '2024-01-01T00:00:00.000Z',
            expires_at: null,
            ...overrides,
          },
        },
      };
      return deserialize<Did>(body).data as Did;
    }

    it('sends only the modified attribute after deserialization', () => {
      const did = deserializeDid();
      // Mutate in place (same object reference, snapshot exists)
      (did as Record<string, unknown>).description = 'new description';

      const result = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      expect(result.data.id).toBe('did-1');
      expect(result.data.attributes.description).toBe('new description');
      // No other writable attributes should be present
      const attrKeys = Object.keys(result.data.attributes);
      expect(attrKeys).toEqual(['description']);
      expect(result.data.relationships).toBeUndefined();
    });

    it('omits non-dirty fields even if they have non-null values', () => {
      const did = deserializeDid();
      // Mutate only description
      (did as Record<string, unknown>).description = 'changed';

      const result = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      // These writable fields should NOT be in the PATCH
      expect(result.data.attributes?.capacity_limit).toBeUndefined();
      expect(result.data.attributes?.terminated).toBeUndefined();
      expect(result.data.attributes?.billing_cycles_count).toBeUndefined();
      expect(result.data.attributes?.dedicated_channels_count).toBeUndefined();
    });

    it('detects setting a field to null as dirty', () => {
      const did = deserializeDid({ description: 'has value' });
      (did as Record<string, unknown>).description = null;

      const result = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      expect(result.data.attributes.description).toBeNull();
      const attrKeys = Object.keys(result.data.attributes);
      expect(attrKeys).toEqual(['description']);
    });

    it('detects no changes → no attributes or relationships', () => {
      const did = deserializeDid();
      // No mutation at all

      const result = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      expect(result.data.id).toBe('did-1');
      // When there are zero dirty fields, kitsu-core omits attributes entirely
      expect(result.data.attributes).toBeUndefined();
      expect(result.data.relationships).toBeUndefined();
    });

    it('fresh object (no snapshot) treats all present keys as dirty', () => {
      // When user builds a fresh object (not deserialized), there's no snapshot,
      // so all present writable keys are treated as dirty
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        description: 'test',
        capacityLimit: 10,
        terminated: false,
      });
      expect(result.data.attributes.description).toBe('test');
      expect(result.data.attributes.capacity_limit).toBe(10);
      expect(result.data.attributes.terminated).toBe(false);
    });
  });

  describe('Scenario 4 & 5: DID exclusive trunk relationships', () => {
    it('set voiceInTrunk → voiceInTrunkGroup explicitly null in PATCH', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        voiceInTrunk: { id: 'trunk-1', type: 'voice_in_trunks' },
      });
      expect(result.data.relationships?.voice_in_trunk).toEqual({
        data: { id: 'trunk-1', type: 'voice_in_trunks' },
      });
      expect(result.data.relationships?.voice_in_trunk_group).toEqual({
        data: null,
      });
    });

    it('set voiceInTrunkGroup → voiceInTrunk explicitly null in PATCH', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        voiceInTrunkGroup: { id: 'group-1', type: 'voice_in_trunk_groups' },
      });
      expect(result.data.relationships?.voice_in_trunk_group).toEqual({
        data: { id: 'group-1', type: 'voice_in_trunk_groups' },
      });
      expect(result.data.relationships?.voice_in_trunk).toEqual({
        data: null,
      });
    });

    it('clear voiceInTrunk (null) does not affect voiceInTrunkGroup', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        voiceInTrunk: null,
      });
      expect(result.data.relationships?.voice_in_trunk).toEqual({ data: null });
      expect(result.data.relationships?.voice_in_trunk_group).toBeUndefined();
    });

    it('clear voiceInTrunkGroup (null) does not affect voiceInTrunk', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        voiceInTrunkGroup: null,
      });
      expect(result.data.relationships?.voice_in_trunk_group).toEqual({ data: null });
      expect(result.data.relationships?.voice_in_trunk).toBeUndefined();
    });

    it('exclusive relationships work after deserialization', () => {
      // Simulate a DID loaded with voiceInTrunkGroup
      const body = {
        data: {
          id: 'did-1',
          type: 'dids',
          attributes: {
            number: '+1234567890',
            blocked: false,
            awaiting_registration: false,
            terminated: false,
            description: 'test',
            capacity_limit: 2,
            channels_included_count: 1,
            dedicated_channels_count: 0,
            billing_cycles_count: 1,
            created_at: '2024-01-01',
            expires_at: null,
          },
          relationships: {
            voice_in_trunk_group: { data: { id: 'group-1', type: 'voice_in_trunk_groups' } },
            voice_in_trunk: { data: null },
          },
        },
      };
      const did = deserialize<Did>(body).data as Did;

      // Now switch to voiceInTrunk (exclusive with voiceInTrunkGroup)
      (did as Record<string, unknown>).voiceInTrunk = { id: 'trunk-1', type: 'voice_in_trunks' };

      const result = serializeForUpdate(DID_RESOURCE, did as unknown as DidWrite & { id: string });
      // voiceInTrunk should be set
      expect(result.data.relationships?.voice_in_trunk).toEqual({
        data: { id: 'trunk-1', type: 'voice_in_trunks' },
      });
      // voiceInTrunkGroup should be auto-nullified by exclusive logic
      expect(result.data.relationships?.voice_in_trunk_group).toEqual({
        data: null,
      });
    });
  });

  describe('CREATE behavior unchanged (no dirty filtering)', () => {
    it('serializeForCreate includes all provided writable keys', () => {
      const result = serializeForCreate(DID_RESOURCE, {
        description: 'test',
        capacityLimit: 10,
        terminated: false,
        billingCyclesCount: 1,
        dedicatedChannelsCount: 0,
      });
      expect(result.data.attributes.description).toBe('test');
      expect(result.data.attributes.capacity_limit).toBe(10);
      expect(result.data.attributes.terminated).toBe(false);
      expect(result.data.attributes.billing_cycles_count).toBe(1);
      expect(result.data.attributes.dedicated_channels_count).toBe(0);
    });

    it('serializeForCreate still excludes read-only fields', () => {
      const data = {
        description: 'test',
        number: '+1234567890', // read-only
        blocked: true, // read-only
      };
      const result = serializeForCreate(DID_RESOURCE, data as DidWrite);
      expect(result.data.attributes.description).toBe('test');
      expect(result.data.attributes?.number).toBeUndefined();
      expect(result.data.attributes?.blocked).toBeUndefined();
    });

    it('serializeForCreate wraps null relationships correctly', () => {
      const result = serializeForCreate(DID_RESOURCE, {
        description: 'test',
        voiceInTrunk: null,
      });
      expect(result.data.attributes.description).toBe('test');
      expect(result.data.relationships?.voice_in_trunk).toEqual({ data: null });
    });
  });

  describe('Dirty state cleared after deserialization', () => {
    it('deserialized object has clean state - no dirty fields when passed by reference', () => {
      const body = {
        data: {
          id: 'group-1',
          type: 'voice_in_trunk_groups',
          attributes: {
            name: 'My Group',
            capacity_limit: 500,
            created_at: '2024-01-01',
          },
        },
      };
      const group = deserialize<VoiceInTrunkGroup>(body).data as VoiceInTrunkGroup;

      // Pass the SAME object reference (not spread) - snapshot is tied to this reference
      const result = serializeForUpdate(
        VOICE_IN_TRUNK_GROUP_RESOURCE,
        group as unknown as VoiceInTrunkGroupWrite & { id: string },
      );
      // No dirty fields → kitsu-core omits attributes
      expect(result.data.attributes).toBeUndefined();
    });

    it('spread object loses snapshot → all present writable keys are dirty', () => {
      const body = {
        data: {
          id: 'group-1',
          type: 'voice_in_trunk_groups',
          attributes: {
            name: 'My Group',
            capacity_limit: 500,
            created_at: '2024-01-01',
          },
        },
      };
      const group = deserialize<VoiceInTrunkGroup>(body).data as VoiceInTrunkGroup;

      // Spread creates a new object → no snapshot → all present keys are dirty
      const result = serializeForUpdate(VOICE_IN_TRUNK_GROUP_RESOURCE, {
        ...group,
      } as VoiceInTrunkGroupWrite & { id: string });
      // Both writable keys are present and treated as dirty
      expect(result.data.attributes.name).toBe('My Group');
      expect(result.data.attributes.capacity_limit).toBe(500);
    });

    it('deserialized list items have clean state', () => {
      const body = {
        data: [
          {
            id: 'group-1',
            type: 'voice_in_trunk_groups',
            attributes: { name: 'Group 1', capacity_limit: 500, created_at: '2024-01-01' },
          },
          {
            id: 'group-2',
            type: 'voice_in_trunk_groups',
            attributes: { name: 'Group 2', capacity_limit: null, created_at: '2024-01-02' },
          },
        ],
      };
      const groups = deserialize(body).data as VoiceInTrunkGroup[];

      // Modify only name on first group (in place)
      (groups[0] as Record<string, unknown>).name = 'Updated Group 1';
      const result1 = serializeForUpdate(
        VOICE_IN_TRUNK_GROUP_RESOURCE,
        groups[0] as unknown as VoiceInTrunkGroupWrite & { id: string },
      );
      expect(result1.data.attributes.name).toBe('Updated Group 1');
      expect(result1.data.attributes?.capacity_limit).toBeUndefined();

      // Second group unchanged (pass by reference)
      const result2 = serializeForUpdate(
        VOICE_IN_TRUNK_GROUP_RESOURCE,
        groups[1] as unknown as VoiceInTrunkGroupWrite & { id: string },
      );
      // No dirty fields → kitsu-core omits attributes
      expect(result2.data.attributes).toBeUndefined();
    });
  });

  describe('Null relationship wrapping via relationshipKeys', () => {
    it('VoiceOutTrunk: setting defaultDid to null produces proper relationship', () => {
      const result = serializeForUpdate(VOICE_OUT_TRUNK_RESOURCE, {
        id: 'trunk-1',
        defaultDid: null,
      });
      expect(result.data.relationships?.default_did).toEqual({ data: null });
      // Only defaultDid should be sent, no other fields
      expect(result.data.attributes?.name).toBeUndefined();
    });

    it('VoiceOutTrunk: setting defaultDid to a ref produces proper relationship', () => {
      const result = serializeForUpdate(VOICE_OUT_TRUNK_RESOURCE, {
        id: 'trunk-1',
        defaultDid: { id: 'did-1', type: 'dids' },
      });
      expect(result.data.relationships?.default_did).toEqual({
        data: { id: 'did-1', type: 'dids' },
      });
    });

    it('DID: setting capacityPool to null produces proper relationship', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        capacityPool: null,
      });
      expect(result.data.relationships?.capacity_pool).toEqual({ data: null });
    });

    it('DID: setting sharedCapacityGroup to null produces proper relationship', () => {
      const result = serializeForUpdate(DID_RESOURCE, {
        id: 'did-1',
        sharedCapacityGroup: null,
      });
      expect(result.data.relationships?.shared_capacity_group).toEqual({ data: null });
    });

    it('VoiceInTrunkGroup: clearing voiceInTrunks with empty array produces proper relationship', () => {
      const result = serializeForUpdate(VOICE_IN_TRUNK_GROUP_RESOURCE, {
        id: 'group-1',
        voiceInTrunks: [],
      });
      expect(result.data.relationships?.voice_in_trunks).toEqual({ data: [] });
      expect(result.data.attributes?.voice_in_trunks).toBeUndefined();
    });
  });
});
