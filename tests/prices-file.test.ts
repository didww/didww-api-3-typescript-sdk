import { describe, it, expect, afterEach, beforeEach, onTestFinished } from 'vitest';
import {
  createWriteStream,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import nock from 'nock';
import { DidwwClientError, DidwwPricesError, PricesErrorKind } from '../src/errors.js';
import type { DidwwClient } from '../src/client.js';
import { closedPort, RawServer, stubClient, type CannedReply } from './helpers/http-stub.js';
import type { StubClientOptions, StubServer } from './helpers/http-stub.js';
import { failure, mintedAudiences, pricesFixture, serviceRequests, startPricesStub } from './helpers/prices.js';

const FILE = '/v3/prices.csv.gz';
const GZ = pricesFixture('voice_in_prices.csv.gz');
const LAST_MODIFIED = 'Thu, 01 Oct 2026 08:05:03 GMT';
const LAST_MODIFIED_SECONDS = Date.UTC(2026, 9, 1, 8, 5, 3) / 1000;

let stub: StubServer | null = null;
let raw: RawServer | null = null;
let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'didww-prices-'));
});

afterEach(async () => {
  await stub?.close();
  await raw?.close();
  stub = null;
  raw = null;
  rmSync(dir, { recursive: true, force: true });
});

async function start(...replies: Parameters<StubServer['on']>[1][]): Promise<StubServer> {
  stub = await startPricesStub();
  if (replies.length > 0) stub.on(`GET ${FILE}`, ...replies).on(`HEAD ${FILE}`, ...replies);
  return stub;
}

const fileReply = (body: Buffer = GZ, headers: Record<string, string> = {}): CannedReply => ({
  status: 200,
  headers: {
    'Content-Type': 'application/gzip',
    'Last-Modified': LAST_MODIFIED,
    'Content-Disposition': 'attachment; filename="voice_in_prices.csv.gz"',
    ...headers,
  },
  body,
});

const notModified: CannedReply = { status: 304, headers: { 'Last-Modified': LAST_MODIFIED } };
const unavailable = (retryAfter?: string): CannedReply => ({
  status: 503,
  headers: { 'Content-Type': 'application/vnd.api+json', ...(retryAfter ? { 'Retry-After': retryAfter } : {}) },
  body: pricesFixture('errors/serving_failure.json'),
});

function client(s: { url: string }, options: StubClientOptions = {}): DidwwClient {
  return stubClient(s, options);
}

function sink(): { stream: PassThrough; bytes: () => Buffer } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  return { stream, bytes: () => Buffer.concat(chunks) };
}

const leftovers = () => readdirSync(dir).filter((f) => f.endsWith('.tmp'));

function cutServer(head: string, body: Buffer): Promise<RawServer> {
  return RawServer.start((socket) =>
    socket.once('data', () => {
      socket.write(head);
      socket.end(body);
    }),
  );
}

describe('price file endpoints', () => {
  it.each([
    ['voiceInPrices', '/v3/prices.csv.gz', 'api-vin.didww.com'],
    ['voiceOutPrices', '/v3/prices.csv.gz', 'api-vout.didww.com'],
    ['smsOutA2pPrices', '/v3/sms_out/a2p/prices.csv.gz', 'api-sms.didww.com'],
    ['smsOutP2pPrices', '/v3/sms_out/p2p/prices.csv.gz', 'api-sms.didww.com'],
    ['smsOutOtpPrices', '/v3/sms_out/otp/prices.csv.gz', 'api-sms.didww.com'],
    ['smsInPrices', '/v3/sms_in/prices.csv.gz', 'api-sms.didww.com'],
  ] as const)('%s requests %s', async (accessor, path, audience) => {
    const s = await start();
    s.on(`HEAD ${path}`, fileReply()).on(`GET ${path}`, fileReply());
    const prices = client(s)[accessor]();
    await prices.head();
    const out = sink();
    await prices.download(out.stream);
    expect(serviceRequests(s).map((r) => `${r.method} ${r.path}`)).toEqual([`HEAD ${path}`, `GET ${path}`]);
    expect(mintedAudiences(s)).toEqual([audience]);
    expect(out.bytes().equals(GZ)).toBe(true);
  });
});

describe('download', () => {
  it('writes the file as served and describes it', async () => {
    const s = await start(fileReply());
    const out = sink();
    const file = await client(s).voiceInPrices().download(out.stream);
    expect(out.bytes().equals(GZ)).toBe(true);
    expect(file).toEqual({
      status: 200,
      lastModified: new Date(LAST_MODIFIED_SECONDS * 1000),
      contentLength: GZ.length,
      filename: 'voice_in_prices.csv.gz',
      bytesWritten: GZ.length,
      notModified: false,
    });
    expect(Object.isFrozen(file)).toBe(true);
    expect(out.stream.writableEnded).toBe(false);
    expect(out.stream.listenerCount('error')).toBe(0);

    const [req] = serviceRequests(s);
    expect(req.headers['accept-encoding']).toBe('identity');
    expect(req.headers.authorization).toBe('Bearer access-token-1');
    expect(req.headers.accept).toBeUndefined();
    expect(req.headers['if-none-match']).toBeUndefined();
    expect(req.headers['if-modified-since']).toBeUndefined();
  });

  it('writes a gzip content coding unchanged', async () => {
    const s = await start(fileReply(GZ, { 'Content-Encoding': 'gzip' }));
    const out = sink();
    await client(s).voiceInPrices().download(out.stream);
    expect(out.bytes().equals(GZ)).toBe(true);
  });

  it('sends If-Modified-Since in whole seconds', async () => {
    const s = await start(fileReply());
    await client(s)
      .voiceInPrices()
      .download(sink().stream, { ifModifiedSince: new Date('2026-10-01T08:05:03.999Z') });
    expect(serviceRequests(s)[0].headers['if-modified-since']).toBe(LAST_MODIFIED);
    expect(serviceRequests(s)[0].headers['if-none-match']).toBeUndefined();
  });

  it('writes nothing on 304', async () => {
    const s = await start(notModified);
    const out = sink();
    const file = await client(s).voiceInPrices().download(out.stream, { ifModifiedSince: new Date() });
    expect(out.bytes()).toHaveLength(0);
    expect(file).toMatchObject({ status: 304, notModified: true, contentLength: null, bytesWritten: 0 });
    expect(file.lastModified?.getTime()).toBe(LAST_MODIFIED_SECONDS * 1000);
  });

  it.each([
    ['no destination', undefined, {}],
    ['an object without write', {}, {}],
    ['an invalid date', 'stream', { ifModifiedSince: new Date(NaN) }],
    ['a year above 9999', 'stream', { ifModifiedSince: new Date('+010000-01-01T00:00:00Z') }],
    ['a date string', 'stream', { ifModifiedSince: '2026-10-01' }],
  ])('refuses %s without a request', async (_name, destination, options) => {
    const s = await start(fileReply());
    const dest = destination === 'stream' ? sink().stream : destination;
    const error = await failure(
      client(s)
        .voiceInPrices()
        .download(dest as never, options as never),
    );
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(s.requests).toHaveLength(0);
  });

  it('writes only the answer to the retried request after a 401', async () => {
    const s = await start({ status: 401, body: 'refused' }, fileReply());
    const out = sink();
    await client(s).voiceInPrices().download(out.stream);
    expect(out.bytes().equals(GZ)).toBe(true);
    expect(serviceRequests(s).map((r) => r.headers.authorization)).toEqual([
      'Bearer access-token-1',
      'Bearer access-token-2',
    ]);
  });

  it.each([
    [404, PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED, 'errors/price_plan_not_assigned.json'],
    [403, PricesErrorKind.ACCESS_DENIED, null],
    [302, PricesErrorKind.UNEXPECTED_STATUS, null],
    [202, PricesErrorKind.UNEXPECTED_STATUS, null],
    [204, PricesErrorKind.UNEXPECTED_STATUS, null],
    [500, PricesErrorKind.UNEXPECTED_STATUS, null],
  ] as const)('maps %i to %s and writes nothing', async (status, kind, fixture) => {
    const s = await start({
      status,
      headers: { Location: '/elsewhere', 'Content-Type': 'application/vnd.api+json' },
      body: fixture ? pricesFixture(fixture) : status === 204 ? undefined : 'not json',
    });
    s.on('GET /elsewhere', fileReply());
    const out = sink();
    const error = (await failure(client(s).voiceInPrices().download(out.stream))) as DidwwPricesError;
    expect(error).toBeInstanceOf(DidwwPricesError);
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
    expect(out.bytes()).toHaveLength(0);
    expect(s.hits('GET /elsewhere')).toHaveLength(0);
    expect(serviceRequests(s)).toHaveLength(1);
    expect(out.stream.listenerCount('error')).toBe(0);
  });

  it.each([
    ['at once', (fail: () => void) => fail()],
    ['from a promise', (fail: () => void) => void Promise.resolve().then(fail)],
  ])('propagates a write error of the destination reported %s without crashing', async (_name, report) => {
    const s = await start(fileReply());
    const failing = new Writable({
      write(_chunk, _encoding, callback) {
        report(() => callback(Object.assign(new Error('disk full'), { code: 'ENOSPC' })));
      },
    });
    const error = await failure(client(s).voiceInPrices().download(failing));
    expect(error).not.toBeInstanceOf(DidwwPricesError);
    expect((error as NodeJS.ErrnoException).code).toBe('ENOSPC');
    await new Promise((r) => setTimeout(r, 20));
    expect(failing.listenerCount('error')).toBe(0);
  });

  it.each([
    ['a 200', fileReply()],
    ['a 404', { status: 404, body: pricesFixture('errors/price_plan_not_assigned.json') }],
  ])('propagates the error a stream emits on its own on %s', async (_name, reply) => {
    const s = await start({ ...reply, delayMs: 50 });
    const out = createWriteStream(join(dir, 'missing', 'copy.csv.gz'));
    const error = await failure(client(s).voiceInPrices().download(out));
    expect(error).not.toBeInstanceOf(DidwwClientError);
    expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    expect(out.listenerCount('error')).toBe(0);
  });

  it('writes to an object with only write', async () => {
    const s = await start(fileReply());
    const chunks: Buffer[] = [];
    const dest = {
      write(chunk: Buffer, callback: () => void) {
        chunks.push(chunk);
        callback();
        return true;
      },
    };
    await client(s)
      .voiceInPrices()
      .download(dest as never);
    expect(Buffer.concat(chunks).equals(GZ)).toBe(true);
  });

  describe.each([
    ['ended', (p: PassThrough) => p.end()],
    ['destroyed', (p: PassThrough) => p.destroy()],
  ])('refuses a destination that is %s', (_name, close) => {
    it.each([
      ['a 200', fileReply()],
      ['a 304', notModified],
      ['an error status', unavailable()],
    ])('before the request that would get %s', async (_status, reply) => {
      const s = await start(reply);
      const closed = new PassThrough();
      closed.on('error', () => undefined);
      close(closed);
      const error = await failure(client(s).voiceInPrices().download(closed, { ifModifiedSince: new Date() }));
      expect(error).toBeInstanceOf(DidwwClientError);
      expect(error.message).toBe('the destination stream is closed');
      expect(s.requests).toHaveLength(0);
    });
  });

  it('rejects with the error of a destination that already failed, before any request', async () => {
    const s = await start(fileReply());
    const failed = new PassThrough();
    failed.on('error', () => undefined);
    const cause = Object.assign(new Error('disk'), { code: 'EIO' });
    failed.destroy(cause);
    const error = await failure(client(s).voiceInPrices().download(failed));
    expect(error).toBe(cause);
    expect(s.requests).toHaveLength(0);
  });

  it('reports a body shorter than its Content-Length', async () => {
    raw = await cutServer('HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n', GZ.subarray(0, 10));
    const s = await start();
    const error = (await failure(
      client(s, { voiceInPricesUrl: raw.url }).voiceInPrices().download(sink().stream),
    )) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBe(200);
    expect(error.message).toBe('Prices service: incomplete body');
  });

  it('reports a chunked body cut short', async () => {
    raw = await cutServer('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n', Buffer.from('a\r\n0123456789\r\n'));
    const s = await start();
    const error = (await failure(
      client(s, { voiceInPricesUrl: raw.url }).voiceInPrices().download(sink().stream),
    )) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBe(200);
  });

  it('reports a body that stalls', async () => {
    const s = await start((_req, res) => {
      res.writeHead(200, { 'Content-Length': '1000' });
      res.write(GZ);
    });
    const error = (await failure(
      client(s, { readTimeout: 300 }).voiceInPrices().download(sink().stream),
    )) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBe(200);
    expect(error.message).toBe('Prices service: the read timeout of 300 ms expired');
  });

  it('reports an answer that never comes', async () => {
    const s = await start(() => undefined);
    const error = (await failure(
      client(s, { readTimeout: 300 }).voiceInPrices().download(sink().stream),
    )) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBeNull();
    expect(error.message).toBe('Prices service request failed: ERR_DIDWW_READ_TIMEOUT');
  });

  it('does not count a slow destination as a stalled server', async () => {
    // On nock's sockets a paused body is cut; real sockets show the behaviour.
    nock.restore();
    onTestFinished(() => nock.activate());
    const body = Buffer.alloc(2 << 20, 7);
    const s = await start(fileReply(body));
    let first = true;
    const slow = new Writable({
      highWaterMark: 1024,
      write(_chunk, _encoding, callback) {
        if (first) {
          first = false;
          setTimeout(callback, 400);
        } else {
          callback();
        }
      },
    });
    const file = await client(s, { readTimeout: 150 }).voiceInPrices().download(slow);
    expect(file.bytesWritten).toBe(body.length);
  });

  it('reports a connection failure', async () => {
    const s = await start();
    const port = await closedPort();
    const error = (await failure(
      client(s, { voiceInPricesUrl: `http://127.0.0.1:${port}` })
        .voiceInPrices()
        .download(sink().stream),
    )) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(error.status).toBeNull();
  });
});

describe('head', () => {
  it('returns the metadata of the file', async () => {
    const s = await start(fileReply());
    const file = await client(s).voiceInPrices().head();
    expect(file).toEqual({
      status: 200,
      lastModified: new Date(LAST_MODIFIED_SECONDS * 1000),
      contentLength: GZ.length,
      filename: 'voice_in_prices.csv.gz',
      bytesWritten: 0,
      notModified: false,
    });
    expect(serviceRequests(s)[0].method).toBe('HEAD');
    expect(serviceRequests(s)[0].headers['accept-encoding']).toBe('identity');
  });

  it('reads no Last-Modified that is not an IMF-fixdate', async () => {
    const s = await start(fileReply(GZ, { 'Last-Modified': 'Fri, 01 Oct 2026 08:05:03 GMT' }));
    expect((await client(s).voiceInPrices().head()).lastModified).toBeNull();
  });

  it('reports 304', async () => {
    const s = await start(notModified);
    const file = await client(s)
      .voiceInPrices()
      .head({ ifModifiedSince: new Date(LAST_MODIFIED_SECONDS * 1000) });
    expect(file).toMatchObject({ status: 304, notModified: true, contentLength: null, bytesWritten: 0 });
    expect(serviceRequests(s)[0].headers['if-modified-since']).toBe(LAST_MODIFIED);
  });

  it('maps a 404 without a body to PRICE_PLAN_NOT_ASSIGNED', async () => {
    const s = await start({ status: 404 });
    const error = (await failure(client(s).voiceInPrices().head())) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.PRICE_PLAN_NOT_ASSIGNED);
    expect(error.code).toBe('price_plan_not_assigned');
    expect(error.errors).toEqual([]);
  });
});

describe('503 retries', () => {
  function recording(random = 0) {
    const waits: number[] = [];
    return {
      waits,
      hooks: {
        random: () => random,
        sleep: async (ms: number) => {
          waits.push(ms);
        },
      },
    };
  }

  it('retries a HEAD answered 503', async () => {
    const s = await start(unavailable('2'), fileReply());
    const { waits, hooks } = recording();
    const file = await client(s, { hooks }).voiceInPrices().head();
    expect(file.status).toBe(200);
    expect(waits).toEqual([2000]);
    expect(serviceRequests(s)).toHaveLength(2);
  });

  it('retries a download answered 503 and writes the file once', async () => {
    const s = await start(unavailable('1'), unavailable('0'), fileReply());
    const { waits, hooks } = recording();
    const out = sink();
    await client(s, { hooks }).voiceInPrices().download(out.stream);
    expect(out.bytes().equals(GZ)).toBe(true);
    expect(waits).toEqual([1000, 1000]);
    expect(serviceRequests(s)).toHaveLength(3);
  });

  it('gives up after two retries', async () => {
    const s = await start(unavailable('1'));
    const { waits, hooks } = recording();
    const error = (await failure(client(s, { hooks }).voiceInPrices().download(sink().stream))) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.SERVICE_UNAVAILABLE);
    expect(error.retryAfter).toBe(1);
    expect(error.code).toBe('serving_failure');
    expect(serviceRequests(s)).toHaveLength(3);
    expect(waits).toHaveLength(2);
  });

  it.each([
    ['0', 0, 1],
    ['0', 1, 2],
    ['2', 0, 2],
    ['2', 1, 3],
    ['30', 0, 30],
    ['30', 1, 36],
    ['60', 0, 60],
    ['60', 1, 72],
  ])('waits Retry-After %s with random %d as %d s', async (retryAfter, random, seconds) => {
    const s = await start(unavailable(retryAfter), fileReply());
    const { waits, hooks } = recording(random);
    await client(s, { hooks }).voiceInPrices().head();
    expect(waits).toEqual([seconds * 1000]);
  });

  it.each([['61'], ['Thu, 01 Oct 2026 08:05:03 GMT'], [undefined], ['-1'], ['1.5']])(
    'does not retry Retry-After %s',
    async (retryAfter) => {
      const s = await start(unavailable(retryAfter), fileReply());
      const { waits, hooks } = recording();
      const error = (await failure(client(s, { hooks }).voiceInPrices().head())) as DidwwPricesError;
      expect(error.kind).toBe(PricesErrorKind.SERVICE_UNAVAILABLE);
      expect(waits).toEqual([]);
      expect(serviceRequests(s)).toHaveLength(1);
    },
  );

  it('does not retry a 429', async () => {
    const s = await start({ status: 429, headers: { 'Retry-After': '1' } }, fileReply());
    const { waits, hooks } = recording();
    const error = (await failure(client(s, { hooks }).voiceInPrices().download(sink().stream))) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.TOO_MANY_REQUESTS);
    expect(error.retryAfter).toBe(1);
    expect(waits).toEqual([]);
    expect(serviceRequests(s)).toHaveLength(1);
  });

  it('waits with the CSPRNG by default', async () => {
    const s = await start(unavailable('1'), fileReply());
    const waits: number[] = [];
    await client(s, { hooks: { sleep: async (ms) => void waits.push(ms) } })
      .voiceInPrices()
      .head();
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThanOrEqual(1000);
    expect(waits[0]).toBeLessThan(2000);
  });
});

describe('downloadToFile', () => {
  it('writes the file with the Last-Modified as its modification time', async () => {
    const s = await start(fileReply());
    const dest = join(dir, 'voice_in_prices.csv.gz');
    writeFileSync(dest, 'old');
    const file = await client(s).voiceInPrices().downloadToFile(dest);
    expect(file.bytesWritten).toBe(GZ.length);
    expect(readFileSync(dest).equals(GZ)).toBe(true);
    expect(statSync(dest, { bigint: true }).mtimeNs).toBe(BigInt(LAST_MODIFIED_SECONDS) * 1_000_000_000n);
    expect(leftovers()).toEqual([]);
  });

  it('leaves other temporary files alone', async () => {
    const s = await start(fileReply());
    const other = join(dir, '.voice_in_prices.csv.gz.0123456789abcdef.tmp');
    writeFileSync(other, 'someone else');
    await client(s).voiceInPrices().downloadToFile(join(dir, 'voice_in_prices.csv.gz'));
    expect(readFileSync(other, 'utf8')).toBe('someone else');
  });

  it.each([
    ['an error status', () => ({ status: 404 }) as CannedReply],
    ['a refused token', () => ({ status: 401 }) as CannedReply],
  ])('keeps the existing file on %s', async (_name, reply) => {
    const s = await start(reply());
    const dest = join(dir, 'voice_in_prices.csv.gz');
    writeFileSync(dest, 'old');
    await expect(client(s).voiceInPrices().downloadToFile(dest)).rejects.toBeInstanceOf(DidwwPricesError);
    expect(readFileSync(dest, 'utf8')).toBe('old');
    expect(leftovers()).toEqual([]);
  });

  it('keeps the existing file when the body is cut', async () => {
    raw = await cutServer('HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n', GZ);
    const s = await start();
    const dest = join(dir, 'voice_in_prices.csv.gz');
    writeFileSync(dest, 'old');
    const error = (await failure(
      client(s, { voiceInPricesUrl: raw.url }).voiceInPrices().downloadToFile(dest),
    )) as DidwwPricesError;
    expect(error.kind).toBe(PricesErrorKind.CONNECTION_ERROR);
    expect(readFileSync(dest, 'utf8')).toBe('old');
    expect(leftovers()).toEqual([]);
  });

  it('fails for a missing directory before any request', async () => {
    const s = await start(fileReply());
    const error = await failure(
      client(s)
        .voiceInPrices()
        .downloadToFile(join(dir, 'missing', 'x.csv.gz')),
    );
    expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    expect(s.requests).toHaveLength(0);
  });

  it('refuses a path that is not a string', async () => {
    const s = await start(fileReply());
    for (const path of ['', undefined, new URL('file:///tmp/x'), Buffer.from('x')]) {
      const error = await failure(
        client(s)
          .voiceInPrices()
          .downloadToFile(path as never),
      );
      expect(error).toBeInstanceOf(DidwwClientError);
    }
    expect(s.requests).toHaveLength(0);
  });

  it('uses its own temporary file per download', async () => {
    const s = await start({ ...fileReply(), delayMs: 50 });
    const prices = client(s).voiceInPrices();
    const dest = join(dir, 'voice_in_prices.csv.gz');
    await Promise.all([prices.downloadToFile(dest), prices.downloadToFile(dest)]);
    expect(readFileSync(dest).equals(GZ)).toBe(true);
    expect(leftovers()).toEqual([]);
  });

  it('keeps the current modification time without Last-Modified', async () => {
    const s = await start(fileReply(GZ, { 'Last-Modified': 'yesterday' }));
    const dest = join(dir, 'voice_in_prices.csv.gz');
    const before = Date.now();
    const file = await client(s).voiceInPrices().downloadToFile(dest);
    expect(file.lastModified).toBeNull();
    expect(statSync(dest).mtimeMs).toBeGreaterThan(before - 5000);
  });

  it.skipIf(process.platform === 'win32')('creates the file with 0666 minus the umask', async () => {
    const s = await start(fileReply());
    const prices = client(s).voiceInPrices();
    for (const [umask, mode] of [
      [0o002, 0o664],
      [0o027, 0o640],
      [0o022, 0o644],
    ]) {
      const previous = process.umask(umask);
      try {
        const dest = join(dir, `mode-${umask}.csv.gz`);
        await prices.downloadToFile(dest);
        expect(statSync(dest).mode & 0o777).toBe(mode);
      } finally {
        process.umask(previous);
      }
    }
  });
});

describe('fetch', () => {
  it('downloads without If-Modified-Since when there is no file', async () => {
    const s = await start(fileReply());
    const dest = join(dir, 'voice_in_prices.csv.gz');
    const file = await client(s).voiceInPrices().fetch(dest);
    expect(file.status).toBe(200);
    expect(serviceRequests(s)[0].headers['if-modified-since']).toBeUndefined();
    expect(readFileSync(dest).equals(GZ)).toBe(true);
  });

  it('sends the modification time of the file and keeps it on 304', async () => {
    const s = await start(notModified);
    const dest = join(dir, 'voice_in_prices.csv.gz');
    writeFileSync(dest, 'current');
    utimesSync(dest, LAST_MODIFIED_SECONDS + 0.75, LAST_MODIFIED_SECONDS + 0.75);
    const before = statSync(dest, { bigint: true }).mtimeNs;
    const file = await client(s).voiceInPrices().fetch(dest);
    expect(file.notModified).toBe(true);
    expect(serviceRequests(s)[0].headers['if-modified-since']).toBe(LAST_MODIFIED);
    expect(readFileSync(dest, 'utf8')).toBe('current');
    expect(statSync(dest, { bigint: true }).mtimeNs).toBe(before);
    expect(leftovers()).toEqual([]);
  });

  it('replaces a changed file', async () => {
    const s = await start(fileReply());
    const dest = join(dir, 'voice_in_prices.csv.gz');
    writeFileSync(dest, 'stale');
    utimesSync(dest, LAST_MODIFIED_SECONDS - 86400, LAST_MODIFIED_SECONDS - 86400);
    const file = await client(s).voiceInPrices().fetch(dest);
    expect(file.status).toBe(200);
    expect(serviceRequests(s)[0].headers['if-modified-since']).toBe('Wed, 30 Sep 2026 08:05:03 GMT');
    expect(readFileSync(dest).equals(GZ)).toBe(true);
    expect(statSync(dest, { bigint: true }).mtimeNs).toBe(BigInt(LAST_MODIFIED_SECONDS) * 1_000_000_000n);
  });
});
