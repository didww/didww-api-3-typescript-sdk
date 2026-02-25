import { describe, it, expect } from 'vitest';
import { deserialize, serializeForCreate, serializeForUpdate } from '../src/serializer.js';

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
      expect(result.meta).toEqual({ total_count: 100 });
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
      const result = deserialize(body);
      const data = result.data as Record<string, unknown>;
      expect(data.country).toBeDefined();
      expect(data.country.data.name).toBe('US');
    });
  });

  describe('serializeForCreate', () => {
    it('serializes with writable keys only', () => {
      const meta = {
        type: 'voice_in_trunk_groups',
        path: 'voice_in_trunk_groups',
        writableKeys: ['name', 'capacity_limit'] as string[],
      };
      const data = { name: 'Test Group', capacity_limit: 'shared', extra: 'ignored' };
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
        writableKeys: ['description', 'voice_in_trunk'] as string[],
      };
      const data = {
        description: 'test',
        voice_in_trunk: { id: '123', type: 'voice_in_trunks' },
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
