import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { deserialize, serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { isIncluded } from '../src/resources/base.js';
import type { Did } from '../src/resources/did.js';
import { SMS_TRUNK_RESOURCE, type SmsTrunk } from '../src/resources/sms-trunk.js';
import type { SmsTrunkGroup } from '../src/resources/sms-trunk-group.js';
import { type HttpClient, Repository } from '../src/repositories/repository.js';
import { isSmsHttpOut } from '../src/nested/sms-trunk-configuration.js';
import type { SmsHttpOutConfiguration } from '../src/nested/sms-trunk-configuration.js';
import type { Region } from '../src/resources/region.js';
import type { Country } from '../src/resources/country.js';
import type { Export } from '../src/resources/export.js';
import type { VoiceInTrunk } from '../src/resources/voice-in-trunk.js';
import type { VoiceInTrunkGroup } from '../src/resources/voice-in-trunk-group.js';
import type { VoiceOutTrunk } from '../src/resources/voice-out-trunk.js';
import type { EmergencyCallingService } from '../src/resources/emergency-calling-service.js';
import type { DidGroup } from '../src/resources/did-group.js';
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

    it('builds a cyclic nested include completely, once per include path', () => {
      // sms_trunks?include=outgoing_dids.sms_trunk: every DID is an outgoing DID of
      // one trunk and receives on another trunk of the same page.
      const trunks = 50;
      const didsPerTrunk = 2;
      const trunkId = (i: number) => `t-${i}`;
      const didId = (i: number) => `d-${i}`;
      const receivingTrunk = (m: number) => (m * 7 + 3) % trunks;
      const body = {
        data: Array.from({ length: trunks }, (_, i) => ({
          id: trunkId(i),
          type: 'sms_trunks',
          attributes: {
            name: `trunk ${i}`,
            configuration: { type: 'http_out', attributes: { auth_name: 'generated-name', auth_password: 'secret' } },
          },
          relationships: {
            outgoing_dids: {
              data: Array.from({ length: didsPerTrunk }, (_, j) => ({ type: 'dids', id: didId(i * didsPerTrunk + j) })),
            },
          },
        })),
        included: Array.from({ length: trunks * didsPerTrunk }, (_, m) => ({
          id: didId(m),
          type: 'dids',
          attributes: { number: String(m) },
          relationships: { sms_trunk: { data: { type: 'sms_trunks', id: trunkId(receivingTrunk(m)) } } },
        })),
      };

      const started = Date.now();
      const result = deserialize<SmsTrunk>(body, 'outgoing_dids.sms_trunk');
      expect(Date.now() - started).toBeLessThan(1000);

      const seen = new Set<object>();
      const visit = (value: unknown): void => {
        if (value === null || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        Object.values(value).forEach(visit);
      };
      visit(result.data);
      expect(seen.size).toBeLessThan(20 * trunks * (didsPerTrunk + 1));
      expect(() => JSON.stringify(result.data)).not.toThrow();

      const data = result.data as SmsTrunk[];
      expect(data).toHaveLength(trunks);
      const dids = data.flatMap((t) => t.outgoingDids ?? []);
      expect(dids).toHaveLength(trunks * didsPerTrunk);
      dids.forEach((did, m) => {
        expect(isIncluded(did)).toBe(true);
        const smsTrunk = (did as Did).smsTrunk!;
        expect(isIncluded(smsTrunk)).toBe(true);
        expect((smsTrunk as SmsTrunk).name).toBe(`trunk ${receivingTrunk(m)}`);
        // outgoing_dids is not requested below sms_trunk.
        expect((smsTrunk as SmsTrunk).outgoingDids).toEqual(
          Array.from({ length: didsPerTrunk }, (_, j) => ({
            id: didId(receivingTrunk(m) * didsPerTrunk + j),
            type: 'dids',
          })),
        );
      });

      const twice = (dids as Did[]).filter((d) => d.smsTrunk!.id === trunkId(10));
      expect(twice).toHaveLength(2);
      expect(twice[0].smsTrunk).toBe(twice[1].smsTrunk);
      const trunk = twice[0].smsTrunk as SmsTrunk;
      expect(isSmsHttpOut(trunk.configuration)).toBe(true);
      expect((trunk.configuration as SmsHttpOutConfiguration).authPassword).toBe('secret');
      expect(inspect(trunk.configuration)).not.toContain('secret');
      expect(JSON.stringify(trunk.configuration)).toContain('[FILTERED]');
    });

    describe('a resource reached by two include paths', () => {
      // GET /dids?include=sms_trunk.sms_trunk_group.sms_trunks,sms_trunk_group.sms_trunks:
      // d1 receives on trunk s1 of group g1, d2 on group g1.
      const include = 'sms_trunk.sms_trunk_group.sms_trunks,sms_trunk_group.sms_trunks';
      const d1 = {
        id: 'd1',
        type: 'dids',
        attributes: { number: '1' },
        relationships: { sms_trunk: { data: { id: 's1', type: 'sms_trunks' } } },
      };
      const d2 = {
        id: 'd2',
        type: 'dids',
        attributes: { number: '2' },
        relationships: { sms_trunk_group: { data: { id: 'g1', type: 'sms_trunk_groups' } } },
      };
      const included = [
        {
          id: 's1',
          type: 'sms_trunks',
          attributes: {
            name: 'Trunk S1',
            configuration: { type: 'http_in', attributes: { url: 'https://example.com' } },
          },
          relationships: { sms_trunk_group: { data: { id: 'g1', type: 'sms_trunk_groups' } } },
        },
        {
          id: 'g1',
          type: 'sms_trunk_groups',
          attributes: { name: 'Group G1' },
          relationships: { sms_trunks: { data: [{ id: 's1', type: 'sms_trunks' }] } },
        },
      ];
      const expectTrunk = (value: unknown) => {
        expect(isIncluded(value as SmsTrunk)).toBe(true);
        expect((value as SmsTrunk).name).toBe('Trunk S1');
        expect((value as SmsTrunk).configuration.type).toBe('http_in');
      };
      const expectGroup = (value: unknown) => {
        expect(isIncluded(value as SmsTrunkGroup)).toBe(true);
        expect((value as SmsTrunkGroup).name).toBe('Group G1');
      };

      for (const [order, data] of [
        ['d1, d2', [d1, d2]],
        ['d2, d1', [d2, d1]],
      ] as const) {
        it(`holds it in full on every requested path, in the order ${order}`, () => {
          const result = deserialize<Did>(structuredClone({ data, included }), include);
          const dids = result.data as Did[];
          const first = dids.find((d) => d.id === 'd1')!;
          const second = dids.find((d) => d.id === 'd2')!;

          const trunk = first.smsTrunk as SmsTrunk;
          expectTrunk(trunk);
          const trunkGroup = trunk.smsTrunkGroup as SmsTrunkGroup;
          expectGroup(trunkGroup);
          expectTrunk(trunkGroup.smsTrunks![0]);
          // sms_trunk_group is not requested below sms_trunk.sms_trunk_group.sms_trunks.
          expect((trunkGroup.smsTrunks![0] as SmsTrunk).smsTrunkGroup).toEqual({ id: 'g1', type: 'sms_trunk_groups' });

          const group = second.smsTrunkGroup as SmsTrunkGroup;
          expectGroup(group);
          expectTrunk(group.smsTrunks![0]);
          expect((group.smsTrunks![0] as SmsTrunk).smsTrunkGroup).toEqual({ id: 'g1', type: 'sms_trunk_groups' });
          expect(() => JSON.stringify(result.data)).not.toThrow();
        });

        it(`without the include paths places it where it is first reached, in the order ${order}`, () => {
          const dids = deserialize<Did>(structuredClone({ data, included })).data as Did[];
          const first = dids.find((d) => d.id === 'd1')!;
          const second = dids.find((d) => d.id === 'd2')!;
          expectTrunk(first.smsTrunk);
          expect((first.smsTrunk as SmsTrunk).smsTrunkGroup).toEqual({ id: 'g1', type: 'sms_trunk_groups' });
          expectGroup(second.smsTrunkGroup);
          expect((second.smsTrunkGroup as SmsTrunkGroup).smsTrunks).toEqual([{ id: 's1', type: 'sms_trunks' }]);
        });
      }
    });

    describe('a resource with meta that a requested path reaches again', () => {
      // GET /dids?include=sms_trunk.sms_trunk_group.sms_trunks: d1 and d2 receive on
      // trunks t1 and t2 of group g, which carries meta.
      const include = 'sms_trunk.sms_trunk_group.sms_trunks';
      const did = (id: string, trunk: string) => ({
        id,
        type: 'dids',
        attributes: { number: id },
        relationships: { sms_trunk: { data: { id: trunk, type: 'sms_trunks' } } },
      });
      const trunk = (id: string) => ({
        id,
        type: 'sms_trunks',
        attributes: {
          name: `Trunk ${id}`,
          configuration: { type: 'http_in', attributes: { url: 'https://example.com' } },
        },
        relationships: { sms_trunk_group: { data: { id: 'g', type: 'sms_trunk_groups' } } },
      });
      const included = [
        trunk('t1'),
        trunk('t2'),
        {
          id: 'g',
          type: 'sms_trunk_groups',
          attributes: { name: 'Group G' },
          relationships: {
            sms_trunks: {
              data: [
                { id: 't1', type: 'sms_trunks' },
                { id: 't2', type: 'sms_trunks' },
              ],
            },
          },
          meta: { sms_trunks_count: 2 },
        },
      ];
      const expectComplete = (value: unknown) => {
        const keys = JSON.stringify(value);
        expect(keys).not.toContain('"attributes"');
        expect(keys).not.toContain('"relationships"');
      };

      for (const order of [
        ['d1', 'd2'],
        ['d2', 'd1'],
      ]) {
        it(`holds it in full on every position, in the order ${order.join(', ')}`, () => {
          const data = order.map((id) => did(id, id === 'd1' ? 't1' : 't2'));
          const dids = deserialize<Did>(structuredClone({ data, included }), include).data as Did[];
          for (const d of dids) {
            const group = (d.smsTrunk as SmsTrunk).smsTrunkGroup as SmsTrunkGroup;
            expect(group.name).toBe('Group G');
            expect(group.meta).toEqual({ smsTrunksCount: 2 });
            expect((group.smsTrunks as SmsTrunk[]).map((t) => t.name)).toEqual(['Trunk t1', 'Trunk t2']);
          }
          expectComplete(dids);
        });

        it(`holds a voice IN trunk group in full on every position, in the order ${order.join(', ')}`, () => {
          const body = {
            data: order.map((id) => ({
              id,
              type: 'dids',
              attributes: {},
              relationships: {
                voice_in_trunk: { data: { id: id === 'd1' ? 'v1' : 'v2', type: 'voice_in_trunks' } },
              },
            })),
            included: [
              ...['v1', 'v2'].map((id) => ({
                id,
                type: 'voice_in_trunks',
                attributes: { name: `Trunk ${id}` },
                relationships: { voice_in_trunk_group: { data: { id: 'g', type: 'voice_in_trunk_groups' } } },
              })),
              {
                id: 'g',
                type: 'voice_in_trunk_groups',
                attributes: { name: 'Group G' },
                relationships: {
                  voice_in_trunks: {
                    data: [
                      { id: 'v1', type: 'voice_in_trunks' },
                      { id: 'v2', type: 'voice_in_trunks' },
                    ],
                  },
                },
                meta: { trunks_count: 2 },
              },
            ],
          };
          const dids = deserialize<Did>(body, 'voice_in_trunk.voice_in_trunk_group.voice_in_trunks').data as Did[];
          for (const d of dids) {
            const group = (d.voiceInTrunk as VoiceInTrunk).voiceInTrunkGroup as VoiceInTrunkGroup;
            expect(group).toMatchObject({ name: 'Group G', meta: { trunksCount: 2 } });
          }
          expectComplete(dids);
        });
      }

      it('masks the credentials of an HTTP OUT trunk on every position', () => {
        // GET /sender_id_verifications?include=sms_trunk.sender_id_verifications.sms_trunk
        const verification = (id: string) => ({
          id,
          type: 'sender_id_verifications',
          attributes: { name: id },
          relationships: { sms_trunk: { data: { id: 't', type: 'sms_trunks' } } },
          meta: { setup_price: '1.0' },
        });
        const body = {
          data: [verification('s1'), verification('s2')],
          included: [
            {
              id: 't',
              type: 'sms_trunks',
              attributes: {
                name: 'Trunk T',
                configuration: {
                  type: 'http_out',
                  attributes: { auth_name: 'USER-SECRET', auth_password: 'PASS-SECRET' },
                },
              },
              relationships: {
                sender_id_verifications: {
                  data: [
                    { id: 's1', type: 'sender_id_verifications' },
                    { id: 's2', type: 'sender_id_verifications' },
                  ],
                },
              },
              meta: { host: 'https://example.com' },
            },
          ],
        };
        const result = deserialize(body, 'sms_trunk.sender_id_verifications.sms_trunk');
        for (const text of [inspect(result, { depth: null }), JSON.stringify(result)]) {
          expect(text).not.toContain('USER-SECRET');
          expect(text).not.toContain('PASS-SECRET');
          expect(text).toContain('[FILTERED]');
        }
        expectComplete(result.data);
      });
    });

    it('holds the primary resource in full where a requested path leads back to it', () => {
      // GET /sms_trunks/s1?include=sms_trunk_group.sms_trunks
      const body = {
        data: {
          id: 's1',
          type: 'sms_trunks',
          attributes: {
            name: 'Trunk S1',
            configuration: { type: 'http_in', attributes: { url: 'https://example.com' } },
          },
          relationships: { sms_trunk_group: { data: { id: 'g1', type: 'sms_trunk_groups' } } },
        },
        included: [
          {
            id: 'g1',
            type: 'sms_trunk_groups',
            attributes: { name: 'Group G1' },
            relationships: {
              sms_trunks: {
                data: [
                  { id: 's1', type: 'sms_trunks' },
                  { id: 's2', type: 'sms_trunks' },
                ],
              },
            },
          },
          { id: 's2', type: 'sms_trunks', attributes: { name: 'Trunk S2' } },
        ],
      };
      const trunk = deserialize<SmsTrunk>(body, ['sms_trunk_group.sms_trunks']).data as SmsTrunk;
      const members = (trunk.smsTrunkGroup as SmsTrunkGroup).smsTrunks as SmsTrunk[];
      expect(members.map((t) => t.name)).toEqual(['Trunk S1', 'Trunk S2']);
      expect(members[0]).not.toBe(trunk);
      expect(members[0].configuration.type).toBe('http_in');
      expect(members[0].smsTrunkGroup).toEqual({ id: 'g1', type: 'sms_trunk_groups' });
      expect(() => JSON.stringify(trunk)).not.toThrow();
    });

    it('expands the include paths of every repository read', async () => {
      // A trunk of group g1 whose group lists it back, read with include=sms_trunk_group.sms_trunks.
      const document = () => ({
        data: {
          id: 's1',
          type: 'sms_trunks',
          attributes: { name: 'Trunk S1' },
          relationships: { sms_trunk_group: { data: { id: 'g1', type: 'sms_trunk_groups' } } },
        },
        included: [
          {
            id: 'g1',
            type: 'sms_trunk_groups',
            attributes: { name: 'Group G1' },
            relationships: { sms_trunks: { data: [{ id: 's1', type: 'sms_trunks' }] } },
          },
        ],
      });
      const client: HttpClient = {
        get: async () => document(),
        post: async () => document(),
        patch: async () => document(),
        delete: async () => undefined,
      };
      const repository = new Repository(client, SMS_TRUNK_RESOURCE);
      const params = { include: 'sms_trunk_group.sms_trunks' };
      const reads = [
        (await repository.list(params)).data[0],
        (await repository.find('s1', params)).data,
        (await repository.create({ name: 'Trunk S1' }, params)).data,
        (await repository.update({ id: 's1', name: 'Trunk S1' }, params)).data,
      ];
      for (const trunk of reads) {
        const member = (trunk.smsTrunkGroup as SmsTrunkGroup).smsTrunks![0];
        expect(isIncluded(member)).toBe(true);
        expect((member as SmsTrunk).name).toBe('Trunk S1');
      }
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

describe('numberType (forward-compat)', () => {
  it('reads an unknown number type as is', () => {
    const result = deserialize<DidGroup>({
      data: { id: 'dg-1', type: 'did_groups', attributes: { number_type: 'future', is_demo: true } },
    });
    expect((result.data as DidGroup).numberType).toBe('future');
    expect((result.data as DidGroup).isDemo).toBe(true);
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
