import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { deserialize, serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { SMS_TRUNK_RESOURCE, type SmsTrunk, type SmsTrunkWrite } from '../src/resources/sms-trunk.js';
import { DidwwClientError } from '../src/errors.js';
import { JsonNumber, stringifyJson } from '../src/json.js';
import { SmsHttpMethod, SmsServerLocation } from '../src/enums.js';
import {
  deserializeSmsTrunkConfiguration,
  genericSmsTrunkConfiguration,
  isGenericSmsTrunkConfiguration,
  isSmsHttpIn,
  isSmsHttpOut,
  isSmsSmppEsme,
  isSmsSmppSmsc,
  isSmsToEmail,
  redactSmsTrunkConfiguration,
  serializeSmsTrunkConfiguration,
  smsHttpInConfiguration,
  smsHttpOutConfiguration,
  smsSmppEsmeConfiguration,
  smsSmppSmscConfiguration,
  smsToEmailConfiguration,
} from '../src/nested/sms-trunk-configuration.js';
import type {
  GenericSmsTrunkConfiguration,
  SmsHttpInConfiguration,
  SmsHttpOutConfiguration,
  SmsSmppEsmeConfiguration,
  SmsTrunkConfiguration,
} from '../src/nested/sms-trunk-configuration.js';

const TRUNK_ID = '1a2b3c4d-0002-4a5b-8c6d-7e8f9a0b1c02';

function trunkDocument(configuration: unknown, extra: Record<string, unknown> = {}) {
  return {
    data: {
      id: TRUNK_ID,
      type: 'sms_trunks',
      attributes: {
        name: 'trunk',
        allow_any_did_as_source: false,
        ...(configuration ? { configuration } : {}),
        ...extra,
      },
    },
  };
}

function load(configuration: unknown, extra: Record<string, unknown> = {}): SmsTrunk {
  return deserialize<SmsTrunk>(trunkDocument(configuration, extra)).data as SmsTrunk;
}

function update(trunk: SmsTrunkWrite & { id: string }) {
  return serializeForUpdate(SMS_TRUNK_RESOURCE, trunk).data;
}

describe('SMS trunk configuration dispatch', () => {
  it.each([
    ['sms_to_email', isSmsToEmail],
    ['http_in', isSmsHttpIn],
    ['http_out', isSmsHttpOut],
    ['smpp_esme', isSmsSmppEsme],
    ['smpp_smsc', isSmsSmppSmsc],
  ] as const)('reads %s as a typed configuration', (type, guard) => {
    const cfg = load({ type, attributes: {} }).configuration;
    expect(cfg.type).toBe(type);
    expect(guard(cfg)).toBe(true);
    expect(isGenericSmsTrunkConfiguration(cfg)).toBe(false);
  });

  it('reads an unknown type as a generic configuration with wire keys', () => {
    const cfg = load({ type: 'future_transport', attributes: { some_key: 'v', 'X-Header': 'h' } }).configuration;
    expect(isGenericSmsTrunkConfiguration(cfg)).toBe(true);
    expect(cfg).toEqual({ type: 'future_transport', attributes: { some_key: 'v', 'X-Header': 'h' } });
    for (const guard of [isSmsToEmail, isSmsHttpIn, isSmsHttpOut, isSmsSmppEsme, isSmsSmppSmsc]) {
      expect(guard(cfg)).toBe(false);
    }
  });

  it('tells a generic configuration with a known type name apart by its attributes', () => {
    const cfg = genericSmsTrunkConfiguration('http_in', { url: 'https://example.com' });
    expect(isGenericSmsTrunkConfiguration(cfg)).toBe(true);
    expect(isSmsHttpIn(cfg)).toBe(false);
  });

  it('leaves the configuration out when a sparse fieldset omits it', () => {
    const trunk = deserialize<SmsTrunk>({ data: { id: TRUNK_ID, type: 'sms_trunks', attributes: { name: 'x' } } })
      .data as SmsTrunk;
    expect('configuration' in trunk).toBe(false);
  });

  it('keeps the user dictionaries of http_in exactly as received', () => {
    const cfg = load({
      type: 'http_in',
      attributes: {
        query_parameters: { apiKey: 'a', ABC: 'b' },
        headers: { 'X-Source': 'didww', 'x-api-key': 'k' },
        body: { field_one: '{SMS_TEXT}', fieldTwo: '{SMS_SRC_ADDR}' },
      },
    }).configuration as SmsHttpInConfiguration;
    expect(cfg.queryParameters).toEqual({ apiKey: 'a', ABC: 'b' });
    expect(cfg.headers).toEqual({ 'X-Source': 'didww', 'x-api-key': 'k' });
    expect(cfg.body).toEqual({ field_one: '{SMS_TEXT}', fieldTwo: '{SMS_SRC_ADDR}' });
  });

  it('turns exact numbers of a typed configuration into numbers', () => {
    const cfg = deserializeSmsTrunkConfiguration({
      type: 'smpp_smsc',
      attributes: { tx_port: new JsonNumber('2775.0'), connection_timeout: 30 },
    });
    expect((cfg as { txPort?: unknown }).txPort).toBe(2775);
  });

  it('keeps unknown attributes of a typed configuration readable but never sends them', () => {
    const cfg = load({ type: 'sms_to_email', attributes: { send_to: 'a@example.com', new_field: 1 } }).configuration;
    expect((cfg as unknown as Record<string, unknown>).newField).toBe(1);
    expect(serializeSmsTrunkConfiguration(cfg)).toEqual({
      type: 'sms_to_email',
      attributes: { send_to: 'a@example.com' },
    });
  });

  it('gives every trunk of a list its own configuration', () => {
    const doc = {
      data: [
        {
          id: 'a',
          type: 'sms_trunks',
          attributes: { name: 'a', configuration: { type: 'http_in', attributes: { headers: { A: '1' } } } },
        },
        {
          id: 'b',
          type: 'sms_trunks',
          attributes: { name: 'b', configuration: { type: 'http_in', attributes: { headers: { A: '1' } } } },
        },
      ],
    };
    const [a, b] = deserialize<SmsTrunk>(doc).data as SmsTrunk[];
    (a.configuration as SmsHttpInConfiguration).headers!.A = '2';
    expect((b.configuration as SmsHttpInConfiguration).headers).toEqual({ A: '1' });
  });
});

describe('SMS trunk configuration serialization', () => {
  it('sends a typed configuration with wire keys and explicit nulls, never undefined', () => {
    const wire = serializeSmsTrunkConfiguration(
      smsHttpInConfiguration({
        url: 'https://example.com',
        httpMethod: SmsHttpMethod.GET,
        queryParameters: { apiKey: 'a' },
        headers: { 'X-Source': 'didww' },
        bodyType: null,
        body: null,
        followRedirect: undefined,
      }),
    );
    expect(wire).toEqual({
      type: 'http_in',
      attributes: {
        url: 'https://example.com',
        http_method: 'get',
        query_parameters: { apiKey: 'a' },
        headers: { 'X-Source': 'didww' },
        body_type: null,
        body: null,
      },
    });
  });

  it('sends false and 0', () => {
    const wire = serializeSmsTrunkConfiguration(
      smsSmppSmscConfiguration({ txPort: 0, useSsl: false, transceiverMode: false }),
    );
    expect(wire.attributes).toEqual({ tx_port: 0, use_ssl: false, transceiver_mode: false });
  });

  it('clears http_out and smpp_esme attributes with null', () => {
    expect(serializeSmsTrunkConfiguration(smsHttpOutConfiguration({ callbackUrl: null, allowedIps: null }))).toEqual({
      type: 'http_out',
      attributes: { callback_url: null, allowed_ips: null },
    });
    expect(serializeSmsTrunkConfiguration(smsSmppEsmeConfiguration({ systemType: null }))).toEqual({
      type: 'smpp_esme',
      attributes: { system_type: null },
    });
  });

  class EsmeWithCredentials {
    readonly type = 'smpp_esme' as const;
    systemType = 'vma';
    get systemId() {
      return 'generated-id';
    }
    get password() {
      return 'generated-password';
    }
  }

  const readOnlyShapes: ReadonlyArray<[string, () => SmsTrunkConfiguration]> = [
    ['a plain object', () => ({ type: 'http_out', callbackUrl: 'u', authName: 'n', authPassword: 'p' })],
    [
      'a loaded configuration',
      () =>
        load({ type: 'http_out', attributes: { callback_url: 'u', auth_name: 'n', auth_password: 'p' } }).configuration,
    ],
    [
      'a spread copy of a loaded configuration',
      () => ({
        ...load({ type: 'http_out', attributes: { callback_url: 'u', auth_name: 'n', auth_password: 'p' } })
          .configuration,
      }),
    ],
    ['a class instance with getters', () => new EsmeWithCredentials() as unknown as SmsTrunkConfiguration],
  ];

  for (const [name, make] of readOnlyShapes) {
    it(`never sends the read-only credentials of ${name}`, () => {
      const wire = serializeSmsTrunkConfiguration(make());
      const text = JSON.stringify(wire);
      for (const key of ['auth_name', 'auth_password', 'system_id', 'password']) {
        expect(wire.attributes).not.toHaveProperty(key);
      }
      expect(text).not.toContain('generated');
    });
  }

  it('sends the writable smpp_smsc credentials', () => {
    const wire = serializeSmsTrunkConfiguration(smsSmppSmscConfiguration({ systemId: 'didww', password: 'secret' }));
    expect(wire.attributes).toEqual({ system_id: 'didww', password: 'secret' });
  });

  it('sends a generic configuration verbatim, read-only names and nulls included', () => {
    const attributes = { auth_password: 'x', 'X-Key': 'y', cleared: null, n: new JsonNumber('1.10') };
    const wire = serializeSmsTrunkConfiguration(genericSmsTrunkConfiguration('http_out', attributes));
    expect(wire).toEqual({ type: 'http_out', attributes });
    expect(wire.attributes).not.toBe(attributes);
    expect(stringifyJson(wire)).toBe(
      '{"type":"http_out","attributes":{"auth_password":"x","X-Key":"y","cleared":null,"n":1.10}}',
    );
  });

  it('refuses a typed configuration of an unknown type', () => {
    expect(() => serializeSmsTrunkConfiguration({ type: 'future' } as unknown as SmsTrunkConfiguration)).toThrow(
      DidwwClientError,
    );
    expect(() =>
      serializeForCreate(SMS_TRUNK_RESOURCE, { configuration: { type: 'future' } as unknown as SmsTrunkConfiguration }),
    ).toThrow('Unknown SMS trunk configuration type "future": use genericSmsTrunkConfiguration(type, attributes)');
  });

  it('never modifies the caller configuration', () => {
    const cfg = load({ type: 'http_out', attributes: { callback_url: 'u', auth_name: 'n', auth_password: 'p' } })
      .configuration as SmsHttpOutConfiguration;
    const trunk = { id: TRUNK_ID, configuration: cfg };
    update(trunk);
    expect(cfg).toEqual({ type: 'http_out', callbackUrl: 'u', authName: 'n', authPassword: 'p' });
  });
});

describe('SmsTrunk serialization', () => {
  it('does not send an unchanged loaded configuration', () => {
    const trunk = load({ type: 'http_in', attributes: { url: 'u', headers: { 'X-Source': 'didww' } } });
    trunk.name = 'renamed';
    expect(update(trunk)).toEqual({ type: 'sms_trunks', id: TRUNK_ID, attributes: { name: 'renamed' } });
  });

  it('round-trips header names of an edited loaded http_in configuration unchanged', () => {
    const trunk = load({ type: 'http_in', attributes: { url: 'u', headers: { 'X-Source': 'didww' } } });
    (trunk.configuration as SmsHttpInConfiguration).url = 'v';
    expect(stringifyJson(update(trunk))).toBe(
      `{"type":"sms_trunks","id":"${TRUNK_ID}","attributes":{"configuration":{"type":"http_in","attributes":{"url":"v","headers":{"X-Source":"didww"}}}}}`,
    );
  });

  it('detects an in-place edit of a nested dictionary', () => {
    const trunk = load({ type: 'http_in', attributes: { headers: { A: '1' } } });
    (trunk.configuration as SmsHttpInConfiguration).headers!.B = '2';
    expect(update(trunk).attributes?.configuration).toEqual({
      type: 'http_in',
      attributes: { headers: { A: '1', B: '2' } },
    });
  });

  it('sends explicit nulls of the trunk and leaves undefined out', () => {
    const data = serializeForCreate(SMS_TRUNK_RESOURCE, {
      name: 'n',
      externalReferenceId: null,
      priority: null,
      blocked: undefined,
      configuration: smsToEmailConfiguration({ sendTo: 'a@example.com' }),
    }).data;
    expect(data.attributes).toEqual({
      name: 'n',
      external_reference_id: null,
      priority: null,
      configuration: { type: 'sms_to_email', attributes: { send_to: 'a@example.com' } },
    });
  });

  it('never sends read-only attributes and relationships, also on create from a loaded trunk', () => {
    const trunk = deserialize<SmsTrunk>({
      data: {
        id: TRUNK_ID,
        type: 'sms_trunks',
        attributes: { name: 'n', allow_in: true, allow_out: false, created_at: 'c', updated_at: 'u' },
        relationships: {
          incoming_dids: { data: [{ id: 'd1', type: 'dids' }] },
          sender_id_verifications: { data: [{ id: 's1', type: 'sender_id_verifications' }] },
        },
        meta: { host: 'h' },
      },
    }).data as SmsTrunk;
    const created = serializeForCreate(SMS_TRUNK_RESOURCE, trunk).data;
    expect(created.attributes).toEqual({ name: 'n' });
    expect(created.relationships).toBeUndefined();
    expect(created.id).toBeUndefined();
  });

  describe('allowAnyDidAsSource', () => {
    it('clears loaded outgoing DIDs when turned on', () => {
      const trunk = deserialize<SmsTrunk>({
        data: {
          id: TRUNK_ID,
          type: 'sms_trunks',
          attributes: { allow_any_did_as_source: false },
          relationships: { outgoing_dids: { data: [{ id: 'd1', type: 'dids' }] } },
        },
      }).data as SmsTrunk;
      trunk.allowAnyDidAsSource = true;
      expect(update(trunk)).toEqual({
        type: 'sms_trunks',
        id: TRUNK_ID,
        attributes: { allow_any_did_as_source: true },
        relationships: { outgoing_dids: { data: [] } },
      });
    });

    it('does not touch outgoing DIDs that were not loaded', () => {
      const trunk = load(undefined, { allow_any_did_as_source: false });
      trunk.allowAnyDidAsSource = true;
      expect(update(trunk).relationships).toBeUndefined();
    });

    it('does not touch outgoing DIDs of a built object', () => {
      expect(update({ id: TRUNK_ID, allowAnyDidAsSource: true }).relationships).toBeUndefined();
    });

    it('keeps an outgoing DID list the caller sets with the flag', () => {
      const data = update({ id: TRUNK_ID, allowAnyDidAsSource: true, outgoingDids: [{ id: 'd2', type: 'dids' }] });
      expect(data.relationships).toEqual({ outgoing_dids: { data: [{ id: 'd2', type: 'dids' }] } });
    });

    it('does not clear outgoing DIDs when the flag is turned off', () => {
      const data = update({ id: TRUNK_ID, allowAnyDidAsSource: false, outgoingDids: undefined });
      expect(data.relationships).toBeUndefined();
    });
  });
});

describe('SMS trunk configuration redaction', () => {
  const cases: ReadonlyArray<[string, SmsTrunkConfiguration, readonly string[], readonly string[]]> = [
    [
      'http_in',
      smsHttpInConfiguration({ url: 'https://example.com', headers: { Authorization: 'Bearer s3cret' } }),
      ['s3cret'],
      ['https://example.com'],
    ],
    [
      'http_out',
      load({
        type: 'http_out',
        attributes: { callback_url: 'https://cb.example.com', auth_name: 'gen-name', auth_password: 'gen-pass' },
      }).configuration,
      ['gen-name', 'gen-pass'],
      ['https://cb.example.com'],
    ],
    [
      'smpp_esme',
      load({ type: 'smpp_esme', attributes: { system_id: 'esme1234', password: 'gen12345', server_location: 'nyc' } })
        .configuration,
      ['esme1234', 'gen12345'],
      ['nyc'],
    ],
    [
      'smpp_smsc',
      smsSmppSmscConfiguration({
        host: 'smsc.example.com',
        systemId: 'didww',
        password: 'secret',
        serverLocation: SmsServerLocation.NYC,
      }),
      ['secret'],
      ['smsc.example.com', 'didww'],
    ],
    [
      'generic',
      genericSmsTrunkConfiguration('future', { token: 'tok-1', count: new JsonNumber('1.10'), cleared: null }),
      ['tok-1', '1.10'],
      ['token', 'cleared', 'null'],
    ],
  ];

  for (const [name, cfg, hidden, visible] of cases) {
    it(`masks ${name} secrets in inspect and JSON.stringify, keeping the values`, () => {
      for (const output of [inspect(cfg), JSON.stringify(cfg), JSON.stringify({ wrapped: cfg })]) {
        for (const secret of hidden) expect(output).not.toContain(secret);
        for (const value of visible) expect(output).toContain(value);
        expect(output).toContain('[FILTERED]');
      }
      const wire = JSON.stringify(serializeSmsTrunkConfiguration(cfg), (_k, v: unknown) =>
        v instanceof JsonNumber ? v.text : v,
      );
      for (const secret of hidden) {
        if (name === 'http_out' || name === 'smpp_esme') expect(wire).not.toContain(secret);
        else expect(wire).toContain(secret);
      }
    });
  }

  it('redacts with redactSmsTrunkConfiguration without changing the original', () => {
    const cfg = smsHttpOutConfiguration({ callbackUrl: 'u' }) as SmsHttpOutConfiguration;
    cfg.authPassword = 'p';
    expect(redactSmsTrunkConfiguration(cfg)).toEqual({
      type: 'http_out',
      callbackUrl: 'u',
      authPassword: '[FILTERED]',
    });
    expect(cfg.authPassword).toBe('p');
    const generic = genericSmsTrunkConfiguration('x', { a: 1, b: null }) as GenericSmsTrunkConfiguration;
    expect(redactSmsTrunkConfiguration(generic)).toEqual({ type: 'x', attributes: { a: '[FILTERED]', b: null } });
    expect(generic.attributes.a).toBe(1);
  });

  it('keeps the hooks out of enumeration, snapshots and the wire', () => {
    const cfg = smsSmppEsmeConfiguration({ systemType: 'vma' }) as SmsSmppEsmeConfiguration;
    expect(Object.keys(cfg)).toEqual(['type', 'systemType']);
    expect(structuredClone(cfg)).toEqual({ type: 'smpp_esme', systemType: 'vma' });
    const loaded = load({ type: 'smpp_esme', attributes: { system_type: 'vma', password: 'p' } });
    expect(update(loaded).attributes).toBeUndefined();
  });
});
