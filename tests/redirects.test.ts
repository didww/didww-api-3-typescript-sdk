import { describe, it, expect, afterEach } from 'vitest';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { AuthErrorKind, DidwwApiError, DidwwAuthError, DidwwPricesError, PricesErrorKind } from '../src/errors.js';
import { BALANCE_DOCUMENT, JSONAPI, StubServer, stubClient, tokenReply } from './helpers/http-stub.js';
import { failure, mintForRequestedAudience, pricesFixture } from './helpers/prices.js';

const STATUSES = [301, 302, 303, 307, 308];
const TARGET = '/elsewhere';
const EXPORT = '/v3/exports/e1.csv.gz';

let stub: StubServer | null = null;

afterEach(async () => {
  await stub?.close();
  stub = null;
});

// A server whose `route` redirects to TARGET on the same origin, where a
// followed request of any method would succeed.
async function redirecting(route: string, status: number, target: () => object): Promise<StubServer> {
  stub = await StubServer.start();
  stub.on('POST /token', mintForRequestedAudience());
  stub.on(route, { status, headers: { Location: `${stub.url}${TARGET}` } });
  for (const method of ['GET', 'POST', 'HEAD']) stub.on(`${method} ${TARGET}`, target());
  return stub;
}

const targetHits = (s: StubServer) => s.requests.filter((r) => r.path.startsWith(TARGET));

describe.each(STATUSES)('a %i with Location is not followed', (status) => {
  it('by a JSON:API read', async () => {
    const s = await redirecting('GET /v3/balance', status, () => ({ headers: JSONAPI, body: BALANCE_DOCUMENT }));
    const error = await failure(stubClient(s).balance().find());
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(status);
    expect(targetHits(s)).toEqual([]);
  });

  it('by a JSON:API write', async () => {
    const s = await redirecting('POST /v3/voice_in_trunk_groups', status, () => ({ status: 201, headers: JSONAPI }));
    const error = await failure(stubClient(s).voiceInTrunkGroups().create({ name: 'g' }));
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(status);
    expect(targetHits(s)).toEqual([]);
  });

  it('by an export download', async () => {
    const s = await redirecting(`GET ${EXPORT}`, status, () => ({ body: gzipSync('a,b\n') }));
    const error = await failure(stubClient(s).downloadExport(`${s.url}${EXPORT}`));
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(status);
    expect(targetHits(s)).toEqual([]);
  });

  it('by a price file download', async () => {
    const s = await redirecting('GET /v3/prices.csv.gz', status, () => ({
      body: pricesFixture('voice_in_prices.csv.gz'),
    }));
    const error = await failure(stubClient(s).voiceInPrices().download(new PassThrough()));
    expect(error).toBeInstanceOf(DidwwPricesError);
    expect((error as DidwwPricesError).kind).toBe(PricesErrorKind.UNEXPECTED_STATUS);
    expect((error as DidwwPricesError).status).toBe(status);
    expect(targetHits(s)).toEqual([]);
  });

  it('by a price lookup', async () => {
    const s = await redirecting('GET /v3/lookup/prices', status, () => ({
      headers: JSONAPI,
      body: pricesFixture('voice_in/lookup/200.json'),
    }));
    const error = await failure(stubClient(s).voiceInPrices().lookup({ number: '18005550123' }));
    expect(error).toBeInstanceOf(DidwwPricesError);
    expect((error as DidwwPricesError).kind).toBe(PricesErrorKind.UNEXPECTED_STATUS);
    expect((error as DidwwPricesError).status).toBe(status);
    expect(targetHits(s)).toEqual([]);
  });

  it('by a token request', async () => {
    const s = await redirecting('POST /token', status, () => tokenReply());
    s.on('GET /v3/balance', { headers: JSONAPI, body: BALANCE_DOCUMENT });
    const error = await failure(stubClient(s).balance().find());
    expect(error).toBeInstanceOf(DidwwAuthError);
    expect((error as DidwwAuthError).kind).toBe(AuthErrorKind.UNEXPECTED_STATUS);
    expect((error as DidwwAuthError).status).toBe(status);
    expect((error as DidwwAuthError).errorDescription).toBe(
      'the token request was redirected; redirects are not followed',
    );
    expect(targetHits(s)).toEqual([]);
    expect(s.hits('GET /v3/balance')).toEqual([]);
  });
});
