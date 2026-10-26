import { describe, it, expect, afterEach } from 'vitest';
import { inspect } from 'node:util';
import { seededTokenStore, setupClient } from '../helpers/client.js';
import { JSONAPI, StubServer, stubClient } from '../helpers/http-stub.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import { DidwwApiError } from '../../src/errors.js';
import { JsonNumber } from '../../src/json.js';
import { SmsBodyType, SmsHttpMethod, SmsServerLocation } from '../../src/enums.js';
import {
  genericSmsTrunkConfiguration,
  isGenericSmsTrunkConfiguration,
  isSmsHttpIn,
  isSmsHttpOut,
  isSmsSmppEsme,
  isSmsSmppSmsc,
  isSmsToEmail,
  smsHttpInConfiguration,
  smsHttpOutConfiguration,
  smsSmppSmscConfiguration,
  smsToEmailConfiguration,
} from '../../src/nested/sms-trunk-configuration.js';
import type {
  GenericSmsTrunkConfiguration,
  SmsHttpInConfiguration,
  SmsHttpOutConfiguration,
  SmsSmppEsmeConfiguration,
  SmsSmppSmscConfiguration,
  SmsToEmailConfiguration,
  SmsTrunkConfiguration,
} from '../../src/nested/sms-trunk-configuration.js';
import type { SmsTrunkGroup } from '../../src/resources/sms-trunk-group.js';
import type { SenderIdVerification } from '../../src/resources/sender-id-verification.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

const HTTP_IN_ID = '1a2b3c4d-0002-4a5b-8c6d-7e8f9a0b1c02';
const HTTP_OUT_ID = '1a2b3c4d-0003-4a5b-8c6d-7e8f9a0b1c03';
const UNKNOWN_ID = '1a2b3c4d-0006-4a5b-8c6d-7e8f9a0b1c06';
const GROUP_ID = '2b3c4d5e-0001-4b6c-9d7e-8f9a0b1c2d01';

describe('SmsTrunks', () => {
  describeOperationEnforcement({
    clientMethod: 'smsTrunks',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'sms_trunks',
  });

  it('lists SMS trunks with every configuration type', async () => {
    const client = setupClient('sms_trunks/list.yaml');
    const result = await client.smsTrunks().list();
    expect(result.data).toHaveLength(5);
    expect(result.meta?.totalRecords).toBe(5);
    const [email, httpIn, httpOut, esme, smsc] = result.data.map((t) => t.configuration);

    expect(isSmsToEmail(email)).toBe(true);
    expect((email as SmsToEmailConfiguration).sendTo).toBe('sms@example.com');

    expect(isSmsHttpIn(httpIn)).toBe(true);
    const http = httpIn as SmsHttpInConfiguration;
    expect(http.httpMethod).toBe(SmsHttpMethod.POST);
    expect(http.queryParameters).toBeNull();
    expect(http.headers).toEqual({ 'X-Source': 'didww' });
    expect(http.bodyType).toBe(SmsBodyType.JSON);
    expect(http.followRedirect).toBe(false);
    expect(http.validateHttpsCertificate).toBe(true);

    expect(isSmsHttpOut(httpOut)).toBe(true);
    expect((httpOut as SmsHttpOutConfiguration).authPassword).toBe('generated-password');
    expect(result.data[2].priority).toBeNull();
    expect(result.data[2].meta?.host).toBe('https://sms-out.example.com/outbound_messages');
    expect(result.data[0].meta).toBeUndefined();

    expect(isSmsSmppEsme(esme)).toBe(true);
    expect((esme as SmsSmppEsmeConfiguration).systemId).toBe('esme1234');
    expect((esme as SmsSmppEsmeConfiguration).serverLocation).toBe(SmsServerLocation.NYC);

    expect(isSmsSmppSmsc(smsc)).toBe(true);
    const smpp = smsc as SmsSmppSmscConfiguration;
    expect(smpp.txPort).toBe(2775);
    expect(smpp.connectionTimeout).toBe(30);
    expect(smpp.systemType).toBeNull();

    const first = result.data[0];
    expect(first.allowIn).toBe(true);
    expect(first.allowOut).toBe(false);
    expect(first.externalReferenceId).toBeNull();
    expect(first.smsTrunkGroup).toBeUndefined();
    expect(first.outgoingDids).toBeUndefined();
  });

  it('lists SMS trunks with an included group and its meta', async () => {
    const client = setupClient('sms_trunks/list_with_sms_trunk_group.yaml');
    const result = await client.smsTrunks().list({ include: 'sms_trunk_group' });
    const withGroup = result.data.find((t) => t.smsTrunkGroup && isIncluded(t.smsTrunkGroup));
    expect(withGroup).toBeDefined();
    const group = withGroup!.smsTrunkGroup as SmsTrunkGroup;
    expect(group.id).toBe(GROUP_ID);
    expect(group.meta?.smsTrunksCount).toBe(1);
    // The group links back to the trunk that includes it: the back link is an identifier.
    expect(group.smsTrunks).toEqual([{ id: withGroup!.id, type: 'sms_trunks' }]);
    expect(() => JSON.stringify(result.data)).not.toThrow();
  });

  it('finds an http_out SMS trunk with its host meta', async () => {
    const client = setupClient('sms_trunks/show.yaml');
    const result = await client.smsTrunks().find(HTTP_OUT_ID);
    expect(result.data.name).toBe('http_out trunk');
    expect(result.data.meta?.host).toBe('https://sms-out.example.com/outbound_messages');
    const cfg = result.data.configuration as SmsHttpOutConfiguration;
    expect(cfg.callbackUrl).toBe('https://example.com/sms/status');
    expect(cfg.allowedIps).toEqual(['203.0.113.10']);
    expect(cfg.authName).toBe('generated-name');
  });

  it('finds an SMS trunk with included sender ID verifications and their meta', async () => {
    const client = setupClient('sms_trunks/show_with_sender_id_verifications.yaml');
    const result = await client.smsTrunks().find(HTTP_OUT_ID, { include: 'sender_id_verifications' });
    const sivs = result.data.senderIdVerifications!;
    expect(sivs).toHaveLength(1);
    expect(isIncluded(sivs[0])).toBe(true);
    const siv = sivs[0] as SenderIdVerification;
    expect(siv.meta?.setupPrice).toBe('10.0');
    expect(siv.meta?.monthlyPrice).toBe('15.0');
  });

  it('raises DidwwApiError for a missing SMS trunk', async () => {
    const client = setupClient('sms_trunks/show_not_found.yaml');
    const error = await client
      .smsTrunks()
      .find(HTTP_OUT_ID)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(404);
    expect((error as DidwwApiError).errors[0].title).toBe('Record not found');
  });

  describe('create', () => {
    const cases: ReadonlyArray<[string, SmsTrunkConfiguration]> = [
      [
        'sms_to_email',
        smsToEmailConfiguration({
          sendTo: 'sms@example.com',
          subject: 'Inbound SMS',
          message: 'You have a new message.',
        }),
      ],
      [
        'http_in',
        smsHttpInConfiguration({
          url: 'https://example.com/sms',
          httpMethod: SmsHttpMethod.POST,
          headers: { 'X-Source': 'didww' },
          bodyType: SmsBodyType.JSON,
          body: '{"text":"{SMS_TEXT}","from":"{SMS_SRC_ADDR}"}',
          followRedirect: false,
          validateHttpsCertificate: true,
        }),
      ],
      [
        'http_out',
        // Read-only credentials on a plain object are never sent.
        {
          type: 'http_out',
          callbackUrl: 'https://example.com/sms/status',
          allowedIps: ['203.0.113.10'],
          authName: 'ignored-name',
          authPassword: 'ignored-password',
        },
      ],
      [
        'smpp_esme',
        {
          type: 'smpp_esme',
          allowedIps: ['203.0.113.10'],
          serverLocation: SmsServerLocation.NYC,
          systemId: 'ignored-id',
          password: 'ignored-password',
        },
      ],
      [
        'smpp_smsc',
        smsSmppSmscConfiguration({
          host: 'smsc.example.com',
          txPort: 2775,
          rxPort: 2776,
          transceiverMode: true,
          connectionTimeout: 30,
          useSsl: false,
          systemId: 'didww',
          password: 'secret',
          serverLocation: SmsServerLocation.NYC,
        }),
      ],
    ];

    for (const [type, configuration] of cases) {
      it(`creates an ${type} SMS trunk`, async () => {
        const client = setupClient(`sms_trunks/create_${type}.yaml`);
        const result = await client.smsTrunks().create({ name: `${type} trunk`, configuration });
        expect(result.data.name).toBe(`${type} trunk`);
        expect(result.data.configuration.type).toBe(type);
        expect(isGenericSmsTrunkConfiguration(result.data.configuration)).toBe(false);
      });
    }

    it('returns the generated credentials and host of an http_out trunk', async () => {
      const client = setupClient('sms_trunks/create_http_out.yaml');
      const result = await client.smsTrunks().create({
        name: 'http_out trunk',
        configuration: smsHttpOutConfiguration({
          callbackUrl: 'https://example.com/sms/status',
          allowedIps: ['203.0.113.10'],
        }),
      });
      const cfg = result.data.configuration as SmsHttpOutConfiguration;
      expect(cfg.authName).toBeTruthy();
      expect(cfg.authPassword).toBeTruthy();
      expect(result.data.meta?.host).toBe('https://sms-out.example.com/outbound_messages');
    });

    it('sends the group and the outgoing DIDs as relationships', async () => {
      const client = setupClient('sms_trunks/create_with_relationships.yaml');
      const result = await client.smsTrunks().create({
        name: 'smpp_smsc trunk',
        configuration: smsSmppSmscConfiguration({
          host: 'smsc.example.com',
          systemId: 'didww',
          password: 'secret',
          serverLocation: SmsServerLocation.NYC,
        }),
        smsTrunkGroup: ref('sms_trunk_groups', GROUP_ID),
        outgoingDids: [ref('dids', '9df99644-f1a5-4a3c-99a4-559d758eb96b')],
      });
      expect(result.data.id).toBeDefined();
    });

    it('raises DidwwApiError with the validation errors', async () => {
      const client = setupClient('sms_trunks/create_error.yaml');
      const error = await client
        .smsTrunks()
        .create({ name: 'sms_to_email trunk', configuration: smsToEmailConfiguration({}) })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DidwwApiError);
      const apiError = error as DidwwApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.errors[0].detail).toBe("configuration - send_to can't be blank");
      expect(apiError.errors[0].source?.pointer).toBe('/data/attributes/configuration');
    });
  });

  describe('update', () => {
    it('updates the name and the configuration', async () => {
      const client = setupClient('sms_trunks/update_http_in.yaml');
      const result = await client.smsTrunks().update({
        id: HTTP_IN_ID,
        name: 'Webhook',
        configuration: smsHttpInConfiguration({ url: 'https://example.com/sms/v2' }),
      });
      expect(result.data.name).toBe('Webhook');
      const cfg = result.data.configuration as SmsHttpInConfiguration;
      expect(cfg.url).toBe('https://example.com/sms/v2');
      expect(cfg.headers).toEqual({ 'X-Source': 'didww' });
    });

    it('sends an edited loaded configuration without the read-only credentials', async () => {
      const client = setupClient('sms_trunks/update_loaded_http_out.yaml');
      const { data: trunk } = await client.smsTrunks().find(HTTP_OUT_ID);
      const cfg = trunk.configuration as SmsHttpOutConfiguration;
      cfg.callbackUrl = 'https://example.com/sms/status/v2';
      const result = await client.smsTrunks().update(trunk);
      const updated = result.data.configuration as SmsHttpOutConfiguration;
      expect(updated.callbackUrl).toBe('https://example.com/sms/status/v2');
      expect(updated.authPassword).toBe('generated-password');
      expect(result.data.meta?.host).toBe('https://sms-out.example.com/outbound_messages');
      // The caller's configuration keeps its credentials.
      expect(cfg.authName).toBe('generated-name');
      expect(cfg.authPassword).toBe('generated-password');
    });

    it('does not send an unchanged loaded configuration', async () => {
      const client = setupClient('sms_trunks/update_loaded_name.yaml');
      const { data: trunk } = await client.smsTrunks().find(HTTP_OUT_ID);
      trunk.name = 'Renamed';
      const result = await client.smsTrunks().update(trunk);
      expect(result.data.id).toBe(HTTP_OUT_ID);
      expect(result.data.name).toBe('Renamed');
    });

    it('clears the group and the outgoing DIDs', async () => {
      const client = setupClient('sms_trunks/update_clear_relationships.yaml');
      const result = await client.smsTrunks().update({ id: HTTP_IN_ID, smsTrunkGroup: null, outgoingDids: [] });
      expect(result.data.id).toBe(HTTP_IN_ID);
    });

    it('sends null to clear outgoing DIDs as an empty list', async () => {
      const client = setupClient('sms_trunks/update_clear_relationships.yaml');
      const result = await client.smsTrunks().update({ id: HTTP_IN_ID, smsTrunkGroup: null, outgoingDids: null });
      expect(result.data.id).toBe(HTTP_IN_ID);
    });

    it('sends explicit nulls of a typed configuration', async () => {
      const client = setupClient('sms_trunks/update_generic_nulls.yaml');
      const result = await client.smsTrunks().update({
        id: HTTP_IN_ID,
        configuration: smsHttpInConfiguration({ httpMethod: SmsHttpMethod.GET, bodyType: null, body: null }),
      });
      expect(result.data.id).toBe(HTTP_IN_ID);
      expect(isSmsHttpIn(result.data.configuration)).toBe(true);
      expect(result.data.configuration).toMatchObject({ httpMethod: SmsHttpMethod.GET, bodyType: null, body: null });
    });

    it('sends explicit nulls of a generic configuration', async () => {
      const client = setupClient('sms_trunks/update_generic_nulls.yaml');
      const result = await client.smsTrunks().update({
        id: HTTP_IN_ID,
        configuration: genericSmsTrunkConfiguration('http_in', { http_method: 'get', body_type: null, body: null }),
      });
      expect(result.data.id).toBe(HTTP_IN_ID);
      expect(isSmsHttpIn(result.data.configuration)).toBe(true);
      expect(result.data.configuration).toMatchObject({ httpMethod: SmsHttpMethod.GET, bodyType: null, body: null });
    });

    it('clears loaded outgoing DIDs when allowAnyDidAsSource is turned on', async () => {
      const client = setupClient('sms_trunks/update_allow_any_did_as_source.yaml');
      const { data: trunk } = await client.smsTrunks().find(HTTP_OUT_ID, { include: 'outgoing_dids' });
      expect(trunk.outgoingDids).toHaveLength(1);
      trunk.allowAnyDidAsSource = true;
      const result = await client.smsTrunks().update(trunk);
      expect(result.data.allowAnyDidAsSource).toBe(true);
    });
  });

  it('deletes an SMS trunk', async () => {
    const client = setupClient('sms_trunks/delete.yaml');
    await expect(client.smsTrunks().remove(HTTP_IN_ID)).resolves.toBeUndefined();
  });

  it('raises DidwwApiError when the SMS trunk is in use', async () => {
    const client = setupClient('sms_trunks/delete_error.yaml');
    const error = await client
      .smsTrunks()
      .remove(HTTP_IN_ID)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(422);
    expect((error as DidwwApiError).errors[0].detail).toBe(
      'base - Cannot delete an SMS trunk while DIDs are routed to it',
    );
  });

  it('masks the credentials of a loaded trunk in inspect and JSON output', async () => {
    const client = setupClient('sms_trunks/show.yaml');
    const { data: trunk } = await client.smsTrunks().find(HTTP_OUT_ID);
    for (const output of [inspect(trunk, { depth: 5 }), JSON.stringify(trunk)]) {
      expect(output).not.toContain('generated-name');
      expect(output).not.toContain('generated-password');
      expect(output).toContain('[FILTERED]');
      expect(output).toContain('https://example.com/sms/status');
    }
    expect((trunk.configuration as SmsHttpOutConfiguration).authPassword).toBe('generated-password');
  });
});

describe('SmsTrunks exact generic configuration over the wire', () => {
  // Raw bytes: the YAML cassette helper re-parses bodies, which would lose the exact numbers.
  const SHOW_UNKNOWN = `{"data":{"id":"${UNKNOWN_ID}","type":"sms_trunks","attributes":{"name":"future trunk","external_reference_id":null,"blocked":false,"priority":100,"allow_any_did_as_source":false,"allow_in":true,"allow_out":false,"created_at":"2026-10-01T10:00:00.000Z","updated_at":"2026-10-01T10:00:00.000Z","configuration":{"type":"future_transport","attributes":{"endpoint":"https://example.com/future","retries":3,"enabled":true,"ratio":1.10,"sequence":9007199254740993,"Mixed-Case_key":{"X-Source":"didww"},"nested":{"ids":[123456789012345678901234567890],"cleared":null}}}},"relationships":{"sms_trunk_group":{"links":{"self":"https://sandbox-api.didww.com/v3/sms_trunks/${UNKNOWN_ID}/relationships/sms_trunk_group","related":"https://sandbox-api.didww.com/v3/sms_trunks/${UNKNOWN_ID}/sms_trunk_group"}}}}}`;
  let stub: StubServer | null = null;

  afterEach(async () => {
    await stub?.close();
    stub = null;
  });

  it('keeps every number and key of a generic configuration byte-exact through find and update', async () => {
    stub = await StubServer.start();
    stub.on(`GET /v3/sms_trunks/${UNKNOWN_ID}`, { body: SHOW_UNKNOWN, headers: JSONAPI });
    stub.on(`PATCH /v3/sms_trunks/${UNKNOWN_ID}`, { body: SHOW_UNKNOWN, headers: JSONAPI });
    const client = stubClient(stub, { tokenStore: seededTokenStore() });

    const { data: trunk } = await client.smsTrunks().find(UNKNOWN_ID);
    expect(isGenericSmsTrunkConfiguration(trunk.configuration)).toBe(true);
    const cfg = trunk.configuration as GenericSmsTrunkConfiguration;
    expect(cfg.type).toBe('future_transport');
    expect(cfg.attributes.retries).toBe(3);
    expect(cfg.attributes.ratio).toEqual(new JsonNumber('1.10'));
    expect(cfg.attributes.sequence).toEqual(new JsonNumber('9007199254740993'));
    expect(trunk.priority).toBe(100);

    cfg.attributes.endpoint = 'https://example.com/future/v2';
    const result = await client.smsTrunks().update(trunk);
    expect(isGenericSmsTrunkConfiguration(result.data.configuration)).toBe(true);

    const sent = stub.hits(`PATCH /v3/sms_trunks/${UNKNOWN_ID}`)[0].body.toString('utf8');
    expect(sent).toBe(
      `{"data":{"type":"sms_trunks","id":"${UNKNOWN_ID}","attributes":{"configuration":{"type":"future_transport","attributes":{"endpoint":"https://example.com/future/v2","retries":3,"enabled":true,"ratio":1.10,"sequence":9007199254740993,"Mixed-Case_key":{"X-Source":"didww"},"nested":{"ids":[123456789012345678901234567890],"cleared":null}}}}}}`,
    );
  });

  it('does not resend an unchanged generic configuration with exact numbers', async () => {
    stub = await StubServer.start();
    stub.on(`GET /v3/sms_trunks/${UNKNOWN_ID}`, { body: SHOW_UNKNOWN, headers: JSONAPI });
    stub.on(`PATCH /v3/sms_trunks/${UNKNOWN_ID}`, { body: SHOW_UNKNOWN, headers: JSONAPI });
    const client = stubClient(stub, { tokenStore: seededTokenStore() });

    const { data: trunk } = await client.smsTrunks().find(UNKNOWN_ID);
    trunk.name = 'renamed';
    await client.smsTrunks().update(trunk);
    const sent = stub.hits(`PATCH /v3/sms_trunks/${UNKNOWN_ID}`)[0].body.toString('utf8');
    expect(sent).toBe(`{"data":{"type":"sms_trunks","id":"${UNKNOWN_ID}","attributes":{"name":"renamed"}}}`);
  });
});
