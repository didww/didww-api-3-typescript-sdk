import { describe, it, expect } from 'vitest';
import { deserialize, serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { isIncluded } from '../src/resources/base.js';
import type { Region } from '../src/resources/region.js';
import type { Country } from '../src/resources/country.js';

describe('Serializer', () => {
  describe('deserialize', () => {
    it('deserializes a single resource', () => {
      const body = {
        data: {
          id: '1',
          type: 'countries',
          attributes: { name: 'UK', prefix: '44', iso: 'GB' },
        },
      };
      const result = deserialize(body);
      expect(result.data).toEqual({
        id: '1',
        type: 'countries',
        name: 'UK',
        prefix: '44',
        iso: 'GB',
      });
    });

    it('deserializes a list of resources', () => {
      const body = {
        data: [
          { id: '1', type: 'countries', attributes: { name: 'UK' } },
          { id: '2', type: 'countries', attributes: { name: 'US' } },
        ],
      };
      const result = deserialize(body);
      expect(Array.isArray(result.data)).toBe(true);
      expect((result.data as unknown[]).length).toBe(2);
    });

    it('preserves meta', () => {
      const body = {
        data: { id: '1', type: 'countries', attributes: { name: 'UK' } },
        meta: { total_count: 100 },
      };
      const result = deserialize(body);
      expect(result.meta).toEqual({ totalCount: 100 });
    });

    it('resolves included relationships', () => {
      const body = {
        data: {
          id: '1',
          type: 'regions',
          attributes: { name: 'California' },
          relationships: {
            country: { data: { type: 'countries', id: '2' } },
          },
        },
        included: [{ type: 'countries', id: '2', attributes: { name: 'US', iso: 'US' } }],
      };
      const result = deserialize<Region>(body);
      const data = result.data as Region;
      expect(data.country).toBeDefined();
      const country = data.country as Country;
      expect(country.name).toBe('US');
    });

    it('applies deserializeCustom to included resources via registry', () => {
      const body = {
        data: {
          id: '1',
          type: 'dids',
          attributes: { number: '+1234567890' },
          relationships: {
            voice_in_trunk: { data: { type: 'voice_in_trunks', id: '2' } },
          },
        },
        included: [
          {
            type: 'voice_in_trunks',
            id: '2',
            attributes: {
              name: 'My Trunk',
              configuration: {
                type: 'sip_configurations',
                attributes: { username: 'user1', host: '10.0.0.1' },
              },
            },
          },
        ],
      };
      const result = deserialize(body);
      const data = result.data as Record<string, unknown>;
      const trunk = data.voiceInTrunk as Record<string, unknown>;
      expect(trunk).toBeDefined();
      expect(trunk.name).toBe('My Trunk');
      // deserializeCustom should have unwrapped the nested configuration
      const config = trunk.configuration as Record<string, unknown>;
      expect(config.type).toBe('sip_configurations');
      expect(config.username).toBe('user1');
      expect(config.host).toBe('10.0.0.1');
    });
  });

  describe('serializeForCreate', () => {
    it('serializes with writable keys only', () => {
      const meta = {
        type: 'voice_in_trunk_groups',
        path: 'voice_in_trunk_groups',
        writableKeys: ['name', 'capacityLimit'] as string[],
      };
      const data = { name: 'Test Group', capacityLimit: 'shared', extra: 'ignored' };
      const result = serializeForCreate(meta, data);
      expect(result).toHaveProperty('data');
      const jsonData = result.data as Record<string, unknown>;
      expect(jsonData.type).toBe('voice_in_trunk_groups');
      expect(jsonData.attributes.name).toBe('Test Group');
      expect(jsonData.attributes.capacity_limit).toBe('shared');
      expect(jsonData.attributes.extra).toBeUndefined();
    });

    it('wraps ResourceRef as relationships', () => {
      const meta = {
        type: 'dids',
        path: 'dids',
        writableKeys: ['description', 'voiceInTrunk'] as string[],
      };
      const data = {
        description: 'test',
        voiceInTrunk: { id: '123', type: 'voice_in_trunks' },
      };
      const result = serializeForCreate(meta, data);
      const jsonData = result.data as Record<string, unknown>;
      expect(jsonData.attributes.description).toBe('test');
      // wrapRelationships converts ResourceRef → { data: { id, type } }
      // kitsu-core then detects it as a relationship
      expect(jsonData.relationships).toBeDefined();
      expect(jsonData.relationships.voice_in_trunk.data).toEqual({
        id: '123',
        type: 'voice_in_trunks',
      });
    });
  });

  describe('serializeForUpdate', () => {
    it('includes id in PATCH payload', () => {
      const meta = {
        type: 'voice_in_trunk_groups',
        path: 'voice_in_trunk_groups',
        writableKeys: ['name'] as string[],
      };
      const data = { id: 'abc-123', name: 'Updated' };
      const result = serializeForUpdate(meta, data);
      const jsonData = result.data as Record<string, unknown>;
      expect(jsonData.id).toBe('abc-123');
      expect(jsonData.type).toBe('voice_in_trunk_groups');
      expect(jsonData.attributes.name).toBe('Updated');
    });
  });
});

describe('isIncluded', () => {
  it('returns false for undefined/null', () => {
    expect(isIncluded(undefined)).toBe(false);
    expect(isIncluded(null)).toBe(false);
  });

  it('returns false for a bare ResourceRef (only id + type)', () => {
    expect(isIncluded({ id: '1', type: 'countries' })).toBe(false);
  });

  it('returns true for a fully included resource', () => {
    expect(isIncluded<Country>({ id: '1', type: 'countries', name: 'US', prefix: '1', iso: 'US' })).toBe(true);
  });
});
