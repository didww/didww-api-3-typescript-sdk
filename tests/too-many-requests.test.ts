import { describe, it, expect, afterEach } from 'vitest';
import { DidwwApiError } from '../src/errors.js';
import type { DidwwClient } from '../src/client.js';
import { JSONAPI, StubServer, stubClient, tokenSequence, type CannedReply } from './helpers/http-stub.js';
import { failure } from './helpers/prices.js';

const EXPORT = '/v3/exports/e1.csv.gz';

let stub: StubServer | null = null;

afterEach(async () => {
  await stub?.close();
  stub = null;
});

type Call = (client: DidwwClient, url: string) => Promise<unknown>;

// Every path of the platform API that a 429 can reach, with a read and a write.
const PATHS: [string, string, Call][] = [
  ['a JSON:API read', 'GET /v3/dids', (client) => client.dids().list()],
  ['a JSON:API write', 'POST /v3/voice_in_trunk_groups', (client) => client.voiceInTrunkGroups().create({ name: 'g' })],
  ['an export download', `GET ${EXPORT}`, (client, url) => client.downloadExport(`${url}${EXPORT}`)],
  [
    'a decompressed export download',
    `GET ${EXPORT}`,
    (client, url) => client.downloadAndDecompressExport(`${url}${EXPORT}`),
  ],
  [
    'an encrypted file upload',
    'POST /v3/encrypted_files',
    (client) => client.uploadEncryptedFile('fp', { data: Buffer.from('x') }),
  ],
];

const reply = (status: number, retryAfter?: string, body: CannedReply['body'] = { errors: [] }): CannedReply => ({
  status,
  headers: { ...JSONAPI, ...(retryAfter === undefined ? {} : { 'Retry-After': retryAfter }) },
  body,
});

const TOO_MANY_REQUESTS = {
  errors: [{ status: '429', code: 'too_many_requests', title: 'Too many requests', detail: 'Rate limit exceeded' }],
};

async function apiError(route: string, call: Call, answer: CannedReply): Promise<DidwwApiError> {
  stub = await StubServer.start();
  stub.on('POST /token', tokenSequence()).on(route, answer);
  const error = await failure(call(stubClient(stub), stub.url));
  expect(error).toBeInstanceOf(DidwwApiError);
  return error as DidwwApiError;
}

describe('429 too_many_requests of the platform API', () => {
  it.each(PATHS)('%s rejects with the Retry-After seconds and is not retried', async (_name, route, call) => {
    const error = await apiError(route, call, reply(429, '30', TOO_MANY_REQUESTS));
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(30);
    expect(error.errors.map((e) => e.code)).toEqual(['too_many_requests']);
    expect(error.message).toBe('Rate limit exceeded');
    expect(stub!.hits(route)).toHaveLength(1);
  });

  it.each(PATHS)('%s reads Retry-After of a 429 that is not JSON', async (_name, route, call) => {
    const error = await apiError(route, call, {
      status: 429,
      headers: { 'Content-Type': 'text/html', 'Retry-After': '7' },
      body: '<html>Too Many Requests</html>',
    });
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(7);
    expect(error.errors).toEqual([]);
  });

  it.each(PATHS)('%s reads Retry-After on any error status', async (_name, route, call) => {
    const error = await apiError(route, call, reply(503, '120'));
    expect(error.status).toBe(503);
    expect(error.retryAfter).toBe(120);
  });

  const notSeconds: [string, string | undefined][] = [
    ['absent', undefined],
    ['not an integer', '1.5'],
    ['an HTTP date', 'Wed, 21 Oct 2026 07:28:00 GMT'],
    ['negative', '-1'],
    ['over 9 digits', '1234567890'],
  ];
  describe.each(PATHS)('%s', (_name, route, call) => {
    it.each(notSeconds)('reports no Retry-After when it is %s', async (_case, value) => {
      const error = await apiError(route, call, reply(429, value));
      expect(error.status).toBe(429);
      expect(error.retryAfter).toBeNull();
    });
  });
});
