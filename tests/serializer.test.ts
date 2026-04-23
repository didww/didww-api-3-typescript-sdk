import { describe, it, expect } from 'vitest';
import { deserialize, serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { isIncluded } from '../src/resources/base.js';
import type { Region } from '../src/resources/region.js';
import type { Country } from '../src/resources/country.js';
import type { Export } from '../src/resources/export.js';
import type { VoiceOutTrunk } from '../src/resources/voice-out-trunk.js';
import type { EmergencyCallingService } from '../src/resources/emergency-calling-service.js';
import { isExportCompleted, isActive, isEcsActive } from '../src/status-helpers.js';

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
                attributes: { username: 'user1', host: '203.0.113.1' },
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
      expect(config.host).toBe('203.0.113.1');
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

describe('unknown enum values (forward-compat)', () => {
  it('deserializes a resource with an unknown status value without throwing', () => {
    const body = {
      data: {
        id: '1',
        type: 'exports',
        attributes: {
          status: 'some_future_status',
          export_type: 'cdr_in',
          url: null,
          callback_url: null,
          callback_method: null,
          created_at: '2026-04-01T00:00:00.000Z',
          external_reference_id: null,
        },
      },
    };
    const result = deserialize<Export>(body);
    const data = result.data as Export;
    expect(data.status).toBe('some_future_status');
    expect(isExportCompleted(data)).toBe(false);
  });

  it('deserializes a VoiceOutTrunk with an unknown status value', () => {
    const body = {
      data: {
        id: '2',
        type: 'voice_out_trunks',
        attributes: {
          name: 'Test',
          status: 'suspended',
          on_cli_mismatch_action: 'reject_call',
          allowed_rtp_ips: [],
          allow_any_did_as_cli: false,
          capacity_limit: 10,
          threshold_amount: '0.0',
          media_encryption_mode: 'disabled',
          default_dst_action: 'allow_all',
          dst_prefixes: [],
          force_symmetric_rtp: false,
          rtp_ping: false,
          callback_url: null,
          threshold_reached: false,
          created_at: '2026-04-01T00:00:00.000Z',
          external_reference_id: null,
          emergency_enable_all: false,
          rtp_timeout: null,
          authentication_method: {
            type: 'credential_authentications',
            attributes: { login: 'user', password: 'pass' },
          },
        },
      },
    };
    const result = deserialize<VoiceOutTrunk>(body);
    const data = result.data as VoiceOutTrunk;
    expect(data.status).toBe('suspended');
    expect(isActive(data)).toBe(false);
  });

  it('deserializes an EmergencyCallingService with an unknown status value', () => {
    const body = {
      data: {
        id: '3',
        type: 'emergency_calling_services',
        attributes: {
          name: 'Test ECS',
          reference: 'ECS-0001',
          status: 'under_review',
          activated_at: null,
          canceled_at: null,
          created_at: '2026-04-01T00:00:00.000Z',
          renew_date: null,
        },
      },
    };
    const result = deserialize<EmergencyCallingService>(body);
    const data = result.data as EmergencyCallingService;
    expect(data.status).toBe('under_review');
    expect(isEcsActive(data)).toBe(false);
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
