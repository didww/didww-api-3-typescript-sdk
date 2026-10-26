import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import nock from 'nock';
import { DidwwClient } from '../src/client.js';
import { Environment } from '../src/configuration.js';
import { DidwwApiError, DidwwClientError, DidwwError } from '../src/errors.js';
import { createTestClient, TEST_ACCESS_TOKEN } from './helpers/client.js';
import { getResourceConfig } from '../src/registry.js';
import { closedPort } from './helpers/http-stub.js';
import pkg from '../package.json';

describe('DidwwClient', () => {
  const API = 'https://sandbox-api.didww.com';

  function captureHeaders(scope: nock.Interceptor, status = 200, body: unknown = { data: [] }) {
    const captured: { headers?: Record<string, string | string[]> } = {};
    scope.reply(function () {
      captured.headers = this.req.headers;
      return [status, body as nock.Body, { 'Content-Type': 'application/vnd.api+json' }];
    });
    return captured;
  }

  it('uses sandbox URL by default', () => {
    const client = new DidwwClient({ apiKey: 'test' });
    expect(client.environment).toBe(Environment.SANDBOX);
    expect(client.baseUrl).toBe('https://sandbox-api.didww.com/v3');
    expect(client.authUrl).toBe('https://auth-sandbox.didww.com');
  });

  it('uses sandbox URL when environment is SANDBOX', () => {
    const client = new DidwwClient({ apiKey: 'test', environment: Environment.SANDBOX });
    expect(client.baseUrl).toBe('https://sandbox-api.didww.com/v3');
  });

  it('uses production URL when environment is PRODUCTION', () => {
    const client = new DidwwClient({ apiKey: 'test', environment: Environment.PRODUCTION });
    expect(client.baseUrl).toBe('https://api.didww.com/v3');
    expect(client.authUrl).toBe('https://auth.didww.com');
    expect(client.voiceInPricesUrl).toBe('https://api-vin.didww.com/v3');
    expect(client.voiceOutPricesUrl).toBe('https://api-vout.didww.com/v3');
    expect(client.smsPricesUrl).toBe('https://api-sms.didww.com/v3');
  });

  it('uses custom base URL', () => {
    const client = new DidwwClient({ apiKey: 'test', baseUrl: 'https://custom-api.example.com/v3/' });
    expect(client.baseUrl).toBe('https://custom-api.example.com/v3');
  });

  it('treats an empty base URL as not given', () => {
    const client = new DidwwClient({ apiKey: 'test', baseUrl: '' });
    expect(client.baseUrl).toBe('https://sandbox-api.didww.com/v3');
  });

  it('rejects empty API key', () => {
    expect(() => new DidwwClient({ apiKey: '' })).toThrow(DidwwClientError);
    expect(() => new DidwwClient({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('accepts timeout option', () => {
    const client = new DidwwClient({ apiKey: 'test', timeout: 30_000 });
    expect(client).toBeDefined();
  });

  it('rejects the removed fetch option', () => {
    const fetch = async () => new Response('{}');
    expect(() => new DidwwClient({ apiKey: 'test', fetch } as never)).toThrow(
      'the fetch option was removed in 4.0.0; pass an http.Agent as agent',
    );
  });

  it('defaults to the current API version', () => {
    expect(new DidwwClient({ apiKey: 'test' }).apiVersion).toBe('2026-10-22');
    expect(new DidwwClient({ apiKey: 'test', apiVersion: '2027-01-01' }).apiVersion).toBe('2027-01-01');
  });

  it('sends the bearer token and neither Api-Key nor X-DIDWW-API-Version', async () => {
    const captured = captureHeaders(nock(API).get('/v3/countries'));
    await createTestClient().countries().list();
    expect(captured.headers?.authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
    expect(captured.headers?.['api-key']).toBeUndefined();
    expect(captured.headers?.['x-didww-api-version']).toBeUndefined();
    expect(captured.headers?.accept).toBe('application/vnd.api+json');
    expect(captured.headers?.['content-type']).toBeUndefined();
  });

  it('sends no credentials for the public_keys endpoint', async () => {
    const captured = captureHeaders(nock(API).get('/v3/public_keys'));
    await createTestClient().publicKeys().list();
    expect(captured.headers?.authorization).toBeUndefined();
    expect(captured.headers?.['api-key']).toBeUndefined();
    expect(captured.headers?.['x-didww-api-version']).toBeUndefined();
  });

  it('sends User-Agent header with SDK version', async () => {
    const captured = captureHeaders(nock(API).get('/v3/countries'));
    await createTestClient().countries().list();
    expect(captured.headers?.['user-agent']).toBe(`didww-typescript-sdk/${pkg.version}`);
  });

  it('sends a JSON:API Content-Type with a body', async () => {
    const captured = captureHeaders(nock(API).patch('/v3/dids/d1'), 200, {
      data: { id: 'd1', type: 'dids', attributes: {} },
    });
    await createTestClient().dids().update({ id: 'd1', description: 'x' });
    expect(captured.headers?.['content-type']).toBe('application/vnd.api+json');
  });

  it('sends User-Agent and the bearer token for encrypted file upload', async () => {
    const captured = captureHeaders(nock(API).post('/v3/encrypted_files'), 201, {
      data: { id: 'id-1', type: 'encrypted_files' },
    });
    const id = await createTestClient().uploadEncryptedFile('fingerprint-123', { data: Buffer.from('example') });
    expect(id).toBe('id-1');
    expect(captured.headers?.['user-agent']).toBe(`didww-typescript-sdk/${pkg.version}`);
    expect(captured.headers?.authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
    expect(captured.headers?.['api-key']).toBeUndefined();
    expect(captured.headers?.['x-didww-api-version']).toBeUndefined();
    expect(String(captured.headers?.['content-type'])).toMatch(/^multipart\/form-data; boundary=/);
  });

  it('rejects upload data that is not bytes', async () => {
    await expect(
      createTestClient().uploadEncryptedFile('f', { data: 'text' as unknown as Buffer }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('keeps the API errors of a refused upload', async () => {
    nock(API)
      .post('/v3/encrypted_files')
      .reply(422, { errors: [{ title: 'is invalid', detail: 'file - is invalid', code: '100' }] });
    const error = await createTestClient()
      .uploadEncryptedFile('f', { data: Buffer.from('x') })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(422);
    expect((error as DidwwApiError).errors[0].detail).toBe('file - is invalid');
  });

  it('returns null for an empty or 204 answer', async () => {
    nock(API).get('/v3/a').reply(204).get('/v3/b').reply(200, '');
    const client = createTestClient();
    expect(await client.get('a')).toBeNull();
    expect(await client.get('b')).toBeNull();
  });

  it('rejects a 2xx body that is not JSON instead of turning it into errors', async () => {
    nock(API).get('/v3/countries').reply(200, '<html>maintenance</html>');
    await expect(createTestClient().countries().list()).rejects.toThrow(
      new DidwwClientError('Request GET countries returned a body that is not valid JSON'),
    );
  });

  it('reports a non-document 2xx JSON answer as a client error', async () => {
    nock(API).get('/v3/countries').reply(200, '[1,2]');
    await expect(createTestClient().countries().list()).rejects.toBeInstanceOf(DidwwClientError);
  });

  it('decodes a gzip success body', async () => {
    nock(API)
      .get('/v3/countries')
      .reply(200, gzipSync(JSON.stringify({ data: [] })), {
        'Content-Type': 'application/vnd.api+json',
        'Content-Encoding': 'gzip',
      });
    const result = await createTestClient().countries().list();
    expect(result.data).toEqual([]);
  });

  it('keeps the API errors of an error answer', async () => {
    nock(API)
      .get('/v3/dids/x')
      .reply(404, { errors: [{ title: 'Not found', detail: 'Record not found', status: '404' }] });
    const error = await createTestClient()
      .dids()
      .find('x')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect(error).toBeInstanceOf(DidwwError);
    expect((error as DidwwApiError).message).toBe('Record not found');
  });

  it('reports a redirect as an API error and does not follow it', async () => {
    const elsewhere = nock('https://elsewhere.example.com').get('/v3/countries').reply(200, { data: [] });
    nock(API).get('/v3/countries').reply(302, '', { Location: 'https://elsewhere.example.com/v3/countries' });
    const error = await createTestClient()
      .countries()
      .list()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(302);
    expect(elsewhere.isDone()).toBe(false);
  });

  it('wraps a transport failure in DidwwClientError with a cause', async () => {
    const port = await closedPort();
    const error = await createTestClient({ baseUrl: `http://127.0.0.1:${port}/v3` })
      .countries()
      .list()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DidwwClientError);
    expect((error as Error).message).toBe('Request GET countries failed: ECONNREFUSED');
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  it('has no repositories for the removed pops and DID group types', () => {
    const client = createTestClient();
    expect('pops' in client).toBe(false);
    expect('didGroupTypes' in client).toBe(false);
    expect(getResourceConfig('pops')).toBeUndefined();
    expect(getResourceConfig('did_group_types')).toBeUndefined();
  });

  it('has repositories for the SMS resources', () => {
    const client = createTestClient();
    for (const type of [
      'sms_trunks',
      'sms_trunk_groups',
      'sms_trunk_regenerate_credentials',
      'sender_id_verifications',
    ]) {
      expect(getResourceConfig(type)?.type).toBe(type);
    }
    expect(typeof client.smsTrunks).toBe('function');
    expect(typeof client.smsTrunkGroups).toBe('function');
    expect(typeof client.smsTrunkRegenerateCredentials).toBe('function');
    expect(typeof client.senderIdVerifications).toBe('function');
  });

  it('rejects NaN in a request body', async () => {
    await expect(createTestClient().post('dids', { data: { n: NaN } })).rejects.toThrow(
      'NaN and Infinity cannot be sent as JSON',
    );
  });
});

describe('DidwwApiError', () => {
  it('parses code field from JSON:API error response', () => {
    const body = {
      errors: [{ status: '422', code: 'invalid', detail: 'is invalid', source: { pointer: '/data/attributes/name' } }],
    };
    const error = new DidwwApiError(422, body);
    expect(error.status).toBe(422);
    expect(error.errors.length).toBe(1);
    expect(error.errors[0].code).toBe('invalid');
    expect(error.errors[0].detail).toBe('is invalid');
    expect(error.errors[0].source?.pointer).toBe('/data/attributes/name');
  });

  it('handles errors without code field', () => {
    const body = {
      errors: [{ status: '404', detail: 'Not found' }],
    };
    const error = new DidwwApiError(404, body);
    expect(error.errors[0].code).toBeUndefined();
    expect(error.errors[0].detail).toBe('Not found');
  });

  it('handles empty error body', () => {
    const error = new DidwwApiError(500, {});
    expect(error.errors).toEqual([]);
    expect(error.message).toBe('API error 500');
  });

  it('ignores error entries that are not objects', () => {
    const error = new DidwwApiError(400, { errors: [null, 'x', { detail: 'bad' }] });
    expect(error.errors).toEqual([{ detail: 'bad' }]);
    expect(error.message).toBe('bad');
  });
});
