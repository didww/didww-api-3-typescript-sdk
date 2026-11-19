import { describe, it, expect, afterEach } from 'vitest';
import { inspect } from 'node:util';
import { gzipSync } from 'node:zlib';
import nock from 'nock';
import { DidwwAuthError, DidwwClientError, DidwwPricesError, PricesErrorKind } from '../src/errors.js';
import { VoiceOutPriceCategory } from '../src/prices/rows.js';
import { contentDispositionFilename, formatHttpDate, parseHttpDate } from '../src/prices/http-headers.js';
import type { DidwwClient } from '../src/client.js';
import type { StubServer } from './helpers/http-stub.js';
import { closedPort, RawServer, stubClient, type CannedReply } from './helpers/http-stub.js';
import {
  failure,
  JSONAPI_HEADERS,
  mintedAudiences,
  pricesFixture,
  serviceRequests,
  startPricesStub,
} from './helpers/prices.js';

const LOOKUP = '/v3/lookup/prices';

let stubs: StubServer[] = [];
let raw: RawServer | null = null;

afterEach(async () => {
  await Promise.all(stubs.map((s) => s.close()));
  await raw?.close();
  stubs = [];
  raw = null;
});

async function start(route?: string, ...replies: Parameters<StubServer['on']>[1][]): Promise<StubServer> {
  const stub = await startPricesStub(route, ...replies);
  stubs.push(stub);
  return stub;
}

const json = (fixture: string, status = 200): CannedReply => ({
  status,
  headers: JSONAPI_HEADERS,
  body: pricesFixture(fixture),
});

const document = (attributes: Record<string, unknown>, extra: Record<string, unknown> = {}): CannedReply => ({
  headers: JSONAPI_HEADERS,
  body: { data: [{ id: 'p1', type: 'prices', attributes }], meta: { total_records: 1 }, ...extra },
});

const SMS_IN_ATTRIBUTES = {
  source_prefix: null,
  source_number_length_min: 1,
  source_number_length_max: 15,
  destination_prefix: '1',
  destination_number_length_min: 11,
  destination_number_length_max: 11,
  country: 'United States',
  price: '0.005000',
};

describe('price lookups', () => {
  it('looks up Voice IN prices', async () => {
    const s = await start(`GET ${LOOKUP}`, json('voice_in/lookup/200.json'));
    const result = await stubClient(s).voiceInPrices().lookup({ number: '18005550123' });

    const [req] = serviceRequests(s);
    expect(req.method).toBe('GET');
    expect(req.path).toBe(`${LOOKUP}?filter[number]=18005550123`);
    expect(req.headers.accept).toBe('application/vnd.api+json');
    expect(req.headers['accept-encoding']).toBe('identity');
    expect(req.headers.authorization).toBe('Bearer access-token-1');
    expect(req.headers['user-agent']).toMatch(/^didww-typescript-sdk\//);
    expect(req.headers['api-key']).toBeUndefined();
    expect(mintedAudiences(s)).toEqual(['api-vin.didww.com']);

    expect(result.totalRecords).toBe(2);
    expect(result.rows).toEqual([
      {
        id: 'df73d9e4-46ce-4af0-817e-f090dc8144f1',
        destination: '1800',
        country: 'United States',
        srcCountryName: null,
        sourceType: 'cellular',
        rate: '0.025',
        connectionFee: '0.0',
        initialInterval: 60,
        nextInterval: 60,
        rejectCalls: false,
      },
      {
        id: 'cb1335e1-6cfd-4921-8724-153d9ed67ac3',
        destination: '44800',
        country: 'United Kingdom',
        srcCountryName: 'United Kingdom',
        sourceType: 'fixed',
        rate: null,
        connectionFee: null,
        initialInterval: 60,
        nextInterval: 60,
        rejectCalls: true,
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.rows[0])).toBe(true);
  });

  it('looks up Voice IN prices with a source country', async () => {
    const s = await start(`GET ${LOOKUP}`, json('voice_in/lookup/200.json'));
    await stubClient(s).voiceInPrices().lookup({ src_country_iso: 'GB', number: '18005550123' });
    expect(serviceRequests(s)[0].path).toBe(`${LOOKUP}?filter[number]=18005550123&filter[src_country_iso]=GB`);
  });

  it('looks up Voice OUT prices', async () => {
    const s = await start(`GET ${LOOKUP}`, json('voice_out/lookup/200.json'));
    const result = await stubClient(s).voiceOutPrices().lookup({ number: '493012345' });
    expect(mintedAudiences(s)).toEqual(['api-vout.didww.com']);
    const [scheduled, plain] = result.rows;
    expect(scheduled).toEqual({
      id: '7b82cac2-c42a-4fa9-8da4-ccba2843068f',
      category: VoiceOutPriceCategory.INTERNATIONAL,
      country: 'Germany',
      network: 'Fixed',
      prefix: '4930',
      rate: '0.0045',
      connectionFee: '0.0',
      initialIncrement: 1,
      recurringIncrement: 1,
      rejectCalls: false,
      nextRate: '0.005',
      nextConnectionFee: '0.0',
      nextInitialIncrement: 30,
      nextRecurringIncrement: 6,
      effectiveAt: '2026-11-01T00:00:00.000Z',
      comment: 'Increase and Billing increment change',
    });
    expect(plain.category).toBe(VoiceOutPriceCategory.ORIGIN_BASED);
    expect(plain.nextRate).toBeNull();
    expect(plain.nextInitialIncrement).toBeNull();
    expect(plain.effectiveAt).toBeNull();
    expect(plain.comment).toBeNull();
  });

  it('keeps an unknown Voice OUT category as served', async () => {
    const body = JSON.parse(pricesFixture('voice_out/lookup/200.json').toString());
    body.data[0].attributes.category = 'Premium';
    const s = await start(`GET ${LOOKUP}`, { headers: JSONAPI_HEADERS, body });
    const result = await stubClient(s).voiceOutPrices().lookup({ number: '493012345' });
    expect(result.rows[0].category).toBe('Premium');
  });

  it.each([
    ['smsOutA2pPrices', '/v3/sms_out/a2p/lookup/prices'],
    ['smsOutP2pPrices', '/v3/sms_out/p2p/lookup/prices'],
    ['smsOutOtpPrices', '/v3/sms_out/otp/lookup/prices'],
    ['smsInPrices', '/v3/sms_in/lookup/prices'],
  ] as const)('looks up SMS prices with %s', async (accessor, path) => {
    const fixture = accessor === 'smsInPrices' ? 'sms_in/lookup/200.json' : 'sms_out/lookup/200.json';
    const s = await start(`GET ${path}`, json(fixture));
    const client = stubClient(s);
    await client[accessor]().lookup({ dst_number: '4915112345678' });
    await client[accessor]().lookup({ dst_country_iso: 'DE' });
    await client[accessor]().lookup({ dst_number: '4915112345678', dst_country_iso: 'DE' });
    expect(serviceRequests(s).map((r) => r.path)).toEqual([
      `${path}?filter[dst_number]=4915112345678`,
      `${path}?filter[dst_country_iso]=DE`,
      `${path}?filter[dst_country_iso]=DE&filter[dst_number]=4915112345678`,
    ]);
    expect(mintedAudiences(s)).toEqual(['api-sms.didww.com']);
  });

  it('reads SMS OUT rows', async () => {
    const s = await start('GET /v3/sms_out/a2p/lookup/prices', json('sms_out/lookup/200.json'));
    const result = await stubClient(s).smsOutA2pPrices().lookup({ dst_number: '4915112345678' });
    expect(result.totalRecords).toBe(2);
    expect(result.rows[0]).toEqual({
      id: 'd8e4d372-42a6-4bb6-80ec-6c29c49aa9fd',
      sourcePrefix: null,
      destinationPrefix: '49151',
      country: 'Germany',
      mcc: 262,
      mccName: 'Germany',
      mnc: 1,
      mncName: 'Telekom Deutschland',
      rejectSms: false,
      price: '0.075000',
    });
    expect(result.rows[1].rejectSms).toBe(true);
    expect(result.rows[1].price).toBeNull();
  });

  it('reads SMS IN rows', async () => {
    const s = await start('GET /v3/sms_in/lookup/prices', json('sms_in/lookup/200.json'));
    const result = await stubClient(s).smsInPrices().lookup({ dst_country_iso: 'US' });
    expect(result.rows).toEqual([
      {
        id: 'e93f925e-25ee-4060-bd50-a790b4945d3f',
        sourcePrefix: null,
        sourceNumberLengthMin: 1,
        sourceNumberLengthMax: 15,
        destinationPrefix: '1',
        destinationNumberLengthMin: 11,
        destinationNumberLengthMax: 11,
        country: 'United States',
        price: '0.005000',
      },
    ]);
  });

  it('sends a number given as a number, and values as given', async () => {
    const s = await start(`GET ${LOOKUP}`, json('voice_in/lookup/200.json'));
    const prices = stubClient(s).voiceInPrices();
    await prices.lookup({ number: 18005550123 });
    await prices.lookup({ number: ' 1800 555&0123', src_country_iso: null });
    expect(serviceRequests(s).map((r) => r.path)).toEqual([
      `${LOOKUP}?filter[number]=18005550123`,
      `${LOOKUP}?filter[number]=%201800%20555%260123`,
    ]);
  });

  it('describes the service', async () => {
    const client = stubClient({ url: 'http://127.0.0.1:9' });
    const a2p = client.smsOutA2pPrices();
    expect(a2p.filePath).toBe('sms_out/a2p/prices.csv.gz');
    expect(a2p.lookupPath).toBe('sms_out/a2p/lookup/prices');
    expect(a2p.allowedFilters).toEqual(['dst_number', 'dst_country_iso']);
    expect(client.voiceInPrices().allowedFilters).toEqual(['number', 'src_country_iso']);
    expect(client.voiceOutPrices().allowedFilters).toEqual(['number']);
    expect(client.smsInPrices().filePath).toBe('sms_in/prices.csv.gz');
    expect(inspect(client.voiceInPrices())).toBe('PricesService(http://127.0.0.1:9/v3/lookup/prices)');
  });

  it('calls the host of each service', async () => {
    const vin = await start(`GET ${LOOKUP}`, json('voice_in/lookup/200.json'));
    const vout = await start(`GET ${LOOKUP}`, json('voice_out/lookup/200.json'));
    const sms = await start('GET /v3/sms_in/lookup/prices', json('sms_in/lookup/200.json'));
    const client = stubClient(vin, { voiceOutPricesUrl: vout.url, smsPricesUrl: `${sms.url}/` });
    await client.voiceInPrices().lookup({ number: '18005550123' });
    await client.voiceOutPrices().lookup({ number: '493012345' });
    await client.smsInPrices().lookup({ dst_country_iso: 'US' });
    expect(serviceRequests(vin)).toHaveLength(1);
    expect(serviceRequests(vout)).toHaveLength(1);
    // A base URL without /v3 (here with a trailing slash) gets it appended.
    expect(serviceRequests(sms).map((r) => r.path)).toEqual(['/v3/sms_in/lookup/prices?filter[dst_country_iso]=US']);
  });
});

describe('price lookup filters', () => {
  it.each([
    ['voiceInPrices', {}, 'Filter number is required on lookup/prices'],
    ['voiceInPrices', undefined, 'Filter number is required on lookup/prices'],
    ['voiceInPrices', { number: '  ', src_country_iso: 'GB' }, 'Filter number is required on lookup/prices'],
    [
      'voiceInPrices',
      { number: '1', b: 'x', a: 'y' },
      'Filter a, b is not allowed on lookup/prices (allowed: number, src_country_iso)',
    ],
    [
      'voiceOutPrices',
      { number: '1', src_country_iso: 'GB' },
      'Filter src_country_iso is not allowed on lookup/prices (allowed: number)',
    ],
    ['smsOutA2pPrices', {}, 'One of filters dst_number, dst_country_iso is required on sms_out/a2p/lookup/prices'],
    [
      'smsInPrices',
      { dst_number: null, dst_country_iso: '' },
      'One of filters dst_number, dst_country_iso is required on sms_in/lookup/prices',
    ],
    [
      'smsOutP2pPrices',
      { number: '1' },
      'Filter number is not allowed on sms_out/p2p/lookup/prices (allowed: dst_number, dst_country_iso)',
    ],
    ['voiceInPrices', { number: true }, 'filter number must be a string'],
    ['voiceInPrices', { number: 1.5 }, 'filter number must be a string'],
    ['voiceInPrices', { number: -1 }, 'filter number must be a string'],
    ['voiceInPrices', { number: 1e21 }, 'filter number must be a string'],
    ['voiceInPrices', { number: 10n }, 'filter number must be a string'],
    ['voiceInPrices', { number: ['1'] }, 'filter number must be a string'],
    ['voiceInPrices', 'number=1', 'filters must be an object of filter names to values'],
    ['voiceInPrices', ['1'], 'filters must be an object of filter names to values'],
  ] as const)('%s %o: %s', async (accessor, filters, message) => {
    const s = await start();
    const error = await failure(
      stubClient(s)
        [accessor]()
        .lookup(filters as never),
    );
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe(message);
    expect(s.requests).toHaveLength(0);
  });
});

describe('price lookup errors', () => {
  it.each([
    [
      400,
      'filter_not_allowed.json',
      PricesErrorKind.BAD_REQUEST,
      '102',
      'Prices service: src_country_iso is not allowed.',
    ],
    [403, null, PricesErrorKind.ACCESS_DENIED, null, 'Prices service responded with status 403'],
    [
      404,
      'price_not_found.json',
      PricesErrorKind.PRICE_NOT_FOUND,
      'price_not_found',
      'Prices service: No effective price covers this number in the assigned plan.',
    ],
    [
      404,
      'price_plan_not_assigned.json',
      PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED,
      'price_plan_not_assigned',
      'Prices service: No price plan is assigned to this account.',
    ],
    [
      404,
      null,
      PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED,
      'price_plan_not_assigned',
      'Prices service responded with status 404',
    ],
    [406, null, PricesErrorKind.NOT_ACCEPTABLE, null, 'Prices service responded with status 406'],
    [
      503,
      'serving_failure.json',
      PricesErrorKind.SERVICE_UNAVAILABLE,
      'serving_failure',
      'Prices service: The price file is not available yet.',
    ],
    [500, null, PricesErrorKind.UNEXPECTED_STATUS, null, 'Prices service responded with status 500'],
    [304, null, PricesErrorKind.UNEXPECTED_STATUS, null, 'Prices service responded with status 304'],
    [202, null, PricesErrorKind.UNEXPECTED_STATUS, null, 'Prices service responded with status 202'],
  ] as const)('maps %i %s to %s', async (status, fixture, kind, code, message) => {
    const reply: CannedReply = fixture
      ? { status, headers: JSONAPI_HEADERS, body: pricesFixture(`errors/${fixture}`) }
      : { status };
    const s = await start(`GET ${LOOKUP}`, reply);
    const error = await failure(stubClient(s).voiceInPrices().lookup({ number: '18005550123' }));
    expect(error).toBeInstanceOf(DidwwPricesError);
    const e = error as DidwwPricesError;
    expect(e.kind).toBe(kind);
    expect(e.status).toBe(status);
    expect(e.code).toBe(code);
    expect(e.message).toBe(message);
    expect(e.name).toBe('DidwwPricesError');
    expect(e.errors).toHaveLength(fixture ? 1 : 0);
    expect(serviceRequests(s)).toHaveLength(1);
  });

  it('reports a 429 with its Retry-After and does not retry it', async () => {
    const s = await start(`GET ${LOOKUP}`, { status: 429, headers: { 'Retry-After': ' 7 ' } });
    const error = (await failure(stubClient(s).voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.TOO_MANY_REQUESTS);
    expect(error.retryAfter).toBe(7);
    expect(serviceRequests(s)).toHaveLength(1);
  });

  it('joins the details and titles of every error', async () => {
    const body = { errors: [{ detail: 'first' }, { title: 'second' }, 'junk', { code: 42 }] };
    const s = await start(`GET ${LOOKUP}`, { status: 400, headers: JSONAPI_HEADERS, body });
    const error = (await failure(stubClient(s).voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error.message).toBe('Prices service: first; second');
    expect(error.errors).toHaveLength(3);
    expect(error.code).toBeNull();
  });

  it('reads a numeric code as a string', async () => {
    const body = { errors: [{ code: 102, detail: 'bad' }] };
    const s = await start(`GET ${LOOKUP}`, { status: 400, headers: JSONAPI_HEADERS, body });
    const error = (await failure(stubClient(s).voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error.code).toBe('102');
  });

  it('does not follow redirects', async () => {
    const s = await start(`GET ${LOOKUP}`, { status: 302, headers: { Location: '/elsewhere' } });
    s.on('GET /elsewhere', json('voice_in/lookup/200.json'));
    const error = (await failure(stubClient(s).voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.UNEXPECTED_STATUS);
    expect(error.status).toBe(302);
    expect(s.hits('GET /elsewhere')).toHaveLength(0);
  });

  it('retries a refused token once', async () => {
    const s = await start(`GET ${LOOKUP}`, { status: 401 }, json('voice_in/lookup/200.json'));
    const result = await stubClient(s).voiceInPrices().lookup({ number: '1' });
    expect(result.rows).toHaveLength(2);
    expect(serviceRequests(s).map((r) => r.headers.authorization)).toEqual([
      'Bearer access-token-1',
      'Bearer access-token-2',
    ]);
  });

  it('is not authorized after the retry', async () => {
    const s = await start(`GET ${LOOKUP}`, { status: 401 });
    const error = (await failure(stubClient(s).voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.NOT_AUTHORIZED);
    expect(serviceRequests(s)).toHaveLength(2);
    expect(s.hits('POST /token')).toHaveLength(2);
  });

  it('reports a connection failure', async () => {
    const port = await closedPort();
    const s = await start();
    const client = stubClient(s, { voiceInPricesUrl: `http://127.0.0.1:${port}/v3` });
    const error = (await failure(client.voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error).toBeInstanceOf(DidwwPricesError);
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBeNull();
    expect(error.message).toBe('Prices service request failed: ECONNREFUSED');
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('returns a token error as is', async () => {
    const s = await start(`GET ${LOOKUP}`, json('voice_in/lookup/200.json'));
    s.on('POST /token', { status: 401, body: { error: 'invalid_client', error_description: 'bad key' } });
    const error = await failure(stubClient(s).voiceInPrices().lookup({ number: '1' }));
    expect(error).toBeInstanceOf(DidwwAuthError);
    expect(serviceRequests(s)).toHaveLength(0);
  });

  it('bounds the size of an error body', async () => {
    const padded = Buffer.concat([
      Buffer.from('{"errors":[{"code":"price_not_found"}],"pad":"'),
      Buffer.alloc(2 << 20, 'x'),
      Buffer.from('"}'),
    ]);
    const s = await start(`GET ${LOOKUP}`, { status: 404, headers: JSONAPI_HEADERS, body: padded });
    const error = (await failure(stubClient(s).voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    // The cut document does not parse, so the status decides.
    expect(error.kind).toBe(PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED);
  });

  it('bounds the time of an error body', async () => {
    const s = await start(`GET ${LOOKUP}`, (_req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/vnd.api+json' });
      res.write('{"errors":[{"code":"price_not_found"}]');
      const timer = setInterval(() => res.write(' '), 50);
      res.on('close', () => clearInterval(timer));
    });
    const started = Date.now();
    const error = (await failure(
      stubClient(s, { readTimeout: 300 }).voiceInPrices().lookup({ number: '1' }),
    )) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('price lookup answers', () => {
  const lookup = async (reply: CannedReply) => {
    const s = await start(`GET /v3/sms_in/lookup/prices`, reply);
    return stubClient(s).smsInPrices().lookup({ dst_country_iso: 'US' });
  };

  it('decodes a gzip content coding', async () => {
    const result = await lookup({
      headers: { ...JSONAPI_HEADERS, 'Content-Encoding': 'gzip' },
      body: gzipSync(pricesFixture('sms_in/lookup/200.json')),
    });
    expect(result.rows[0].price).toBe('0.005000');
  });

  it('gives 0 total records when meta is absent', async () => {
    const result = await lookup({
      headers: JSONAPI_HEADERS,
      body: { data: [{ id: 'p1', attributes: SMS_IN_ATTRIBUTES }] },
    });
    expect(result.totalRecords).toBe(0);
  });

  it.each([
    ['not JSON', Buffer.from('<html>'), /^Failed to parse price lookup: /],
    ['invalid UTF-8', Buffer.from([0x7b, 0xff, 0x7d]), /^Failed to parse price lookup: /],
    ['not a document', [1], 'Failed to parse price lookup: the answer is not a JSON:API document'],
    ['no data', {}, 'Failed to parse price lookup: the answer holds no prices'],
    ['empty data', { data: [] }, 'Failed to parse price lookup: the answer holds no prices'],
    ['data not an array', { data: { id: 'p1' } }, 'Failed to parse price lookup: data is not an array'],
    [
      'a row without id',
      { data: [{ attributes: SMS_IN_ATTRIBUTES }] },
      'Failed to parse price lookup: data[0] has no id',
    ],
    [
      'a row without attributes',
      { data: [{ id: 'p1' }] },
      'Failed to parse price lookup: data[0].attributes is not an object',
    ],
    [
      'meta not an object',
      { data: [{ id: 'p1', attributes: SMS_IN_ATTRIBUTES }], meta: 1 },
      'Failed to parse price lookup: meta is not an object',
    ],
    [
      'a boolean total_records',
      { data: [{ id: 'p1', attributes: SMS_IN_ATTRIBUTES }], meta: { total_records: true } },
      'Failed to parse price lookup: meta.total_records is not a non-negative integer',
    ],
  ])('refuses %s', async (_name, body, message) => {
    const error = await failure(lookup({ headers: JSONAPI_HEADERS, body }));
    expect(error).toBeInstanceOf(DidwwClientError);
    if (typeof message === 'string') expect(error.message).toBe(message);
    else expect(error.message).toMatch(message);
  });

  it.each([
    ['price', 0.005, 'is not a decimal string'],
    ['price', 'NaN', 'is not a decimal string'],
    ['price', '1,5', 'is not a decimal string'],
    ['price', null, 'is missing'],
    ['source_number_length_min', '1', 'is not an integer'],
    ['source_number_length_min', 1.5, 'is not an integer'],
    ['source_number_length_min', true, 'is not an integer'],
    ['source_number_length_min', undefined, 'is missing'],
    ['source_prefix', 1, 'is not a string'],
    ['country', false, 'is not a string'],
  ])('refuses %s = %o', async (name, value, reason) => {
    const attributes: Record<string, unknown> = { ...SMS_IN_ATTRIBUTES, [name]: value };
    if (value === undefined) delete attributes[name];
    const error = await failure(lookup(document(attributes)));
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe(`Failed to parse price lookup: data[0].attributes.${name} ${reason}`);
  });

  it('reads an absent nullable attribute as null', async () => {
    const attributes: Record<string, unknown> = { ...SMS_IN_ATTRIBUTES };
    delete attributes.source_prefix;
    const result = await lookup(document(attributes));
    expect(result.rows[0].sourcePrefix).toBeNull();
  });

  it.each(['2026-11-01', '2026-02-30T00:00:00Z', '2026-11-01T24:00:00Z', '2026-11-01T00:00:00+24:00', 'soon'])(
    'refuses effective_at %s',
    async (value) => {
      const body = JSON.parse(pricesFixture('voice_out/lookup/200.json').toString());
      body.data[0].attributes.effective_at = value;
      const s = await start(`GET ${LOOKUP}`, { headers: JSONAPI_HEADERS, body });
      const error = await failure(stubClient(s).voiceOutPrices().lookup({ number: '1' }));
      expect(error.message).toBe(
        'Failed to parse price lookup: data[0].attributes.effective_at is not an RFC 3339 date-time',
      );
    },
  );

  it('reports a body cut short', async () => {
    raw = await RawServer.start((socket) =>
      socket.on('data', (data) => {
        if (!data.toString().startsWith('GET ')) return;
        socket.write('HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n{"data":');
        socket.end();
      }),
    );
    const s = await start();
    const client = stubClient(s, { voiceInPricesUrl: raw.url });
    const error = (await failure(client.voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBe(200);
    expect(error.message).toBe('Prices service: incomplete body');
  });

  it('reports a body shorter than its Content-Length on nock sockets', async () => {
    const body = pricesFixture('voice_in/lookup/200.json');
    nock('https://prices.example.com')
      .get(LOOKUP)
      .query(true)
      .reply(200, body, { 'Content-Length': String(body.length + 10) });
    const s = await start();
    const client = stubClient(s, { voiceInPricesUrl: 'https://prices.example.com' });
    const error = (await failure(client.voiceInPrices().lookup({ number: '1' }))) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBe(200);
    expect(error.message).toMatch(/^Prices service: incomplete body/);
  });
});

describe('price file headers', () => {
  it('parses an IMF-fixdate', () => {
    expect(parseHttpDate('Thu, 01 Oct 2026 08:05:03 GMT')?.toISOString()).toBe('2026-10-01T08:05:03.000Z');
    expect(parseHttpDate(' Sat, 06 Nov 0094 08:49:37 GMT ')?.getUTCFullYear()).toBe(94);
  });

  it.each([
    'Fri, 01 Oct 2026 08:05:03 GMT',
    'Thursday, 01-Oct-26 08:05:03 GMT',
    'Thu Oct  1 08:05:03 2026',
    'Thu, 01 Oct 2026 08:05:03 +0000',
    'Thu, 1 Oct 2026 08:05:03 GMT',
    'Tue, 31 Feb 2026 08:05:03 GMT',
    'Thu, 01 Oct 2026 24:05:03 GMT',
    'Thu, 01 Oct 2026 08:05:03 GMT\n',
    '',
    undefined,
  ])('refuses %o', (value) => {
    expect(parseHttpDate(value)).toBeNull();
  });

  it('formats an IMF-fixdate in whole seconds', () => {
    expect(formatHttpDate(new Date('2026-10-01T08:05:03.999Z'))).toBe('Thu, 01 Oct 2026 08:05:03 GMT');
    const early = new Date(Date.UTC(2000, 0, 1));
    early.setUTCFullYear(5);
    expect(formatHttpDate(early)).toMatch(/^[A-Z][a-z]{2}, 01 Jan 0005 00:00:00 GMT$/);
  });

  it.each([
    ['attachment; filename="voice_in_prices.csv.gz"', 'voice_in_prices.csv.gz'],
    ['attachment; filename=plain.csv.gz', 'plain.csv.gz'],
    ['attachment; filename="a\\"b.gz"', 'a"b.gz'],
    ['attachment; filename="fallback.gz"; filename*=UTF-8\'\'pr%C3%A9+x.gz', 'pré+x.gz'],
    ["attachment; filename*=iso-8859-1''pr%E9.gz", 'pré.gz'],
    ['attachment; filename="fallback.gz"; filename*=UTF-8\'\'bad%ZZ.gz', 'fallback.gz'],
    ['attachment; filename="fallback.gz"; filename*=UTF-8\'\'%FF.gz', 'fallback.gz'],
    ['attachment; filename="fallback.gz"; filename*=koi8-r\'\'x.gz', 'fallback.gz'],
    ['attachment; filename=""', null],
    ['attachment', null],
    [undefined, null],
  ])('reads the file name of %o', (value, name) => {
    expect(contentDispositionFilename(value)).toBe(name);
  });
});

describe('client accessors', () => {
  it('give a new service per call', () => {
    const client: DidwwClient = stubClient({ url: 'http://127.0.0.1:9' });
    expect(client.voiceInPrices()).not.toBe(client.voiceInPrices());
  });
});
