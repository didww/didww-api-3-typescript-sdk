import { describe, it, expect, afterEach, beforeEach, onTestFinished, vi } from 'vitest';
import nock from 'nock';
import { deflateRawSync, deflateSync, gzipSync } from 'node:zlib';
import { DidwwApiError, DidwwAuthError, DidwwClientError } from '../src/errors.js';
import { MemoryTokenStore, type TokenStore } from '../src/auth/token-store.js';
import {
  contentLength,
  isTlsFailure,
  originOf,
  retryAfterSeconds,
  secureRandom,
  spread,
  Transport,
  type TimeoutError,
} from '../src/http/transport.js';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { Readable } from 'node:stream';
import { BodyReadError, readAll } from '../src/http/body.js';
import {
  BALANCE_DOCUMENT,
  JSONAPI,
  RawServer,
  StubServer,
  stubClient,
  tokenReply,
  tokenSequence,
} from './helpers/http-stub.js';
import { seededTokenStore } from './helpers/client.js';

let stub: StubServer | null = null;
let raw: RawServer | null = null;

afterEach(async () => {
  await stub?.close();
  await raw?.close();
  stub = null;
  raw = null;
});

async function startStub(): Promise<StubServer> {
  stub = await StubServer.start();
  stub.on('POST /token', tokenSequence());
  return stub;
}

async function failure(promise: Promise<unknown>): Promise<Error> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(Error);
  return error as Error;
}

const CODINGS = [
  ['deflate', 'zlib', deflateSync],
  ['deflate', 'raw', deflateRawSync],
  ['x-gzip', 'gzip', gzipSync],
] as const;

const DID = { data: { id: 'd1', type: 'dids', attributes: { description: 'x' } } };

describe('bearer', () => {
  it('sends only the bearer token to the API', async () => {
    const s = (await startStub()).on('GET /v3/balance', { headers: JSONAPI, body: BALANCE_DOCUMENT });
    await stubClient(s).balance().find();
    const [call] = s.hits('GET /v3/balance');
    expect(call.headers.authorization).toBe('Bearer access-token-1');
    expect(call.headers['api-key']).toBeUndefined();
    expect(call.headers['x-didww-api-version']).toBeUndefined();
    expect(call.headers['accept-encoding']).toBe('gzip');
    expect(call.headers['content-type']).toBeUndefined();
    expect(call.headers.cookie).toBeUndefined();
  });

  it('sends back no cookie that the API or the token service sets', async () => {
    const setCookie = { 'Set-Cookie': 'sid=abc; Path=/' };
    let mints = 0;
    const s = await StubServer.start();
    stub = s;
    s.on('POST /token', (_req, res) => {
      mints++;
      const body = JSON.stringify(tokenReply({ access_token: `access-token-${mints}` }).body);
      res.writeHead(200, { 'Content-Type': 'application/json', ...setCookie }).end(body);
    });
    s.on(
      'GET /v3/balance',
      { headers: { ...JSONAPI, ...setCookie }, body: BALANCE_DOCUMENT },
      { status: 401 },
      { headers: JSONAPI, body: BALANCE_DOCUMENT },
    );
    const client = stubClient(s);
    await client.balance().find();
    // The 401 makes the client mint again.
    await client.balance().find();
    const calls = [...s.hits('GET /v3/balance'), ...s.hits('POST /token')];
    expect(calls).toHaveLength(5);
    for (const call of calls) expect(call.headers.cookie).toBeUndefined();
  });

  it('sends no credentials to public_keys, but authenticates other paths that contain it', async () => {
    const s = (await startStub())
      .on('GET /v3/public_keys', { headers: JSONAPI, body: { data: [] } })
      .on('GET /v3/dids/public_keys_x', { headers: JSONAPI, body: DID });
    const client = stubClient(s);
    await client.publicKeys().list();
    await client.dids().find('public_keys_x');
    expect(s.hits('GET /v3/public_keys')[0].headers.authorization).toBeUndefined();
    expect(s.hits('POST /token')).toHaveLength(1);
    expect(s.hits('GET /v3/dids/public_keys_x')[0].headers.authorization).toBe('Bearer access-token-1');
  });

  it('mints again and retries once after a 401', async () => {
    const s = (await startStub()).on(
      'GET /v3/balance',
      { status: 401 },
      { status: 200, headers: JSONAPI, body: BALANCE_DOCUMENT },
    );
    const result = await stubClient(s).balance().find();
    expect(result.data.id).toBe('b1');
    expect(s.hits('POST /token')).toHaveLength(2);
    expect(s.hits('GET /v3/balance').map((r) => r.headers.authorization)).toEqual([
      'Bearer access-token-1',
      'Bearer access-token-2',
    ]);
  });

  it('replays the PATCH body after a 401', async () => {
    const s = (await startStub()).on('PATCH /v3/dids/d1', { status: 401 }, { headers: JSONAPI, body: DID });
    await stubClient(s).dids().update({ id: 'd1', description: 'x' });
    const [first, second] = s.hits('PATCH /v3/dids/d1');
    expect(second.body.equals(first.body)).toBe(true);
    expect(JSON.parse(second.body.toString()).data.attributes).toEqual({ description: 'x' });
    expect(second.headers['content-length']).toBe(String(second.body.length));
    expect(second.headers['content-type']).toBe('application/vnd.api+json');
  });

  it('replays the upload body after a 401', async () => {
    const s = (await startStub()).on(
      'POST /v3/encrypted_files',
      { status: 401 },
      { status: 201, headers: JSONAPI, body: { data: { id: 'f1', type: 'encrypted_files' } } },
    );
    const id = await stubClient(s).uploadEncryptedFile('fp', { data: Buffer.from('bytes'), description: 'd' });
    expect(id).toBe('f1');
    const [first, second] = s.hits('POST /v3/encrypted_files');
    expect(second.body.equals(first.body)).toBe(true);
    expect(second.headers['content-type']).toBe(first.headers['content-type']);
    expect(second.body.toString()).toContain('name="encrypted_files[file]"; filename="file.enc"');
  });

  it('evicts the replacement after a second 401 and reports the 401', async () => {
    const s = (await startStub()).on('GET /v3/balance', {
      status: 401,
      body: { errors: [{ title: 'Unauthorized', detail: 'token refused', status: '401' }] },
    });
    const store = new MemoryTokenStore();
    const error = await failure(stubClient(s, { tokenStore: store }).balance().find());
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(401);
    expect(error.message).toBe('token refused');
    expect(s.hits('POST /token')).toHaveLength(2);
    expect(s.hits('GET /v3/balance')).toHaveLength(2);
    expect(store.size).toBe(0);
  });

  it('does not retry a 403', async () => {
    const s = (await startStub()).on('GET /v3/balance', { status: 403, body: { errors: [{ title: 'Forbidden' }] } });
    const error = await failure(stubClient(s).balance().find());
    expect((error as DidwwApiError).status).toBe(403);
    expect(s.hits('POST /token')).toHaveLength(1);
    expect(s.hits('GET /v3/balance')).toHaveLength(1);
  });

  it('surfaces a token error unchanged', async () => {
    stub = await StubServer.start();
    stub.on('POST /token', { status: 401, body: { error: 'invalid_client' } });
    const error = await failure(stubClient(stub).balance().find());
    expect(error).toBeInstanceOf(DidwwAuthError);
    expect(error.message).toBe('Token service: invalid_client');
  });
});

describe('responses', () => {
  it('reports a redirect as an API error without following it', async () => {
    const s = (await startStub())
      .on('GET /v3/balance', { status: 302, headers: { Location: '/elsewhere' }, body: 'moved' })
      .on('GET /elsewhere', { headers: JSONAPI, body: BALANCE_DOCUMENT });
    const error = await failure(stubClient(s).balance().find());
    expect((error as DidwwApiError).status).toBe(302);
    expect((error as DidwwApiError).body).toBe('moved');
    expect(s.hits('GET /elsewhere')).toHaveLength(0);
  });

  it('decodes a gzip error body', async () => {
    const s = (await startStub()).on('GET /v3/balance', {
      status: 422,
      headers: { 'Content-Encoding': 'gzip' },
      body: gzipSync(JSON.stringify({ errors: [{ detail: 'compressed detail' }] })),
    });
    const error = await failure(stubClient(s).balance().find());
    expect(error.message).toBe('compressed detail');
  });

  it.each(CODINGS)('decodes an error body in Content-Encoding %s (%s data)', async (coding, _format, encode) => {
    const s = (await startStub()).on('GET /v3/balance', {
      status: 422,
      headers: { 'Content-Encoding': coding },
      body: encode(JSON.stringify({ errors: [{ title: 'compressed title' }] })),
    });
    const error = (await failure(stubClient(s).balance().find())) as DidwwApiError;
    expect(error.errors[0].title).toBe('compressed title');
  });

  it.each(CODINGS)('decodes a success body in Content-Encoding %s (%s data)', async (coding, _format, encode) => {
    const s = (await startStub()).on('GET /v3/balance', {
      headers: { ...JSONAPI, 'Content-Encoding': coding },
      body: encode(JSON.stringify(BALANCE_DOCUMENT)),
    });
    const result = await stubClient(s).balance().find();
    expect(result.data.balance).toBe('10.00');
  });

  it('normalizes the numbers of an error body', async () => {
    const s = (await startStub()).on('GET /v3/balance', {
      status: 422,
      body: '{"errors":[{"detail":"bad","meta":{"limit":1.10}}]}',
    });
    const error = (await failure(stubClient(s).balance().find())) as DidwwApiError;
    expect(error.errors[0].meta).toEqual({ limit: 1.1 });
  });

  it('limits an error body to 1 MiB', async () => {
    const big = JSON.stringify({ errors: [{ detail: 'too big' }], pad: 'x'.repeat(2 << 20) });
    const s = (await startStub()).on('GET /v3/balance', { status: 500, body: big });
    const error = (await failure(stubClient(s).balance().find())) as DidwwApiError;
    expect(error.status).toBe(500);
    expect(error.errors).toEqual([]);
    expect(error.body as string).toHaveLength(1 << 20);
  });

  it('reads an error body within the read timeout', async () => {
    const s = (await startStub()).on('GET /v3/balance', (_req, res) => {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      const timer = setInterval(() => res.write('x'), 20);
      res.on('close', () => clearInterval(timer));
    });
    const start = Date.now();
    const error = (await failure(stubClient(s, { readTimeout: 300 }).balance().find())) as DidwwApiError;
    expect(error.status).toBe(503);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('refuses an unknown content coding of a success body', async () => {
    const s = (await startStub()).on('GET /v3/balance', {
      headers: { ...JSONAPI, 'Content-Encoding': 'br' },
      body: 'xx',
    });
    const error = await failure(stubClient(s).balance().find());
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe('Request GET balance failed: unsupported Content-Encoding "br"');
  });

  it('reports a success body cut short', async () => {
    raw = await RawServer.start((socket) =>
      socket.once('data', () =>
        socket.end('HTTP/1.1 200 OK\r\nContent-Type: application/vnd.api+json\r\nContent-Length: 100\r\n\r\n{"data"'),
      ),
    );
    const client = stubClient({ url: raw.url }, { tokenStore: seededTokenStore() });
    const error = await failure(client.balance().find());
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe('Request GET balance failed: ECONNRESET');
  });
});

describe('timeouts', () => {
  it('limits connecting, the TLS handshake included', async () => {
    // nock's socket reports a connection at once; only a real socket shows the handshake.
    nock.restore();
    onTestFinished(() => nock.activate());
    raw = await RawServer.start(() => undefined);
    const client = stubClient({ url: `https://127.0.0.1:${raw.port}` }, { connectTimeout: 200 });
    const start = Date.now();
    const error = await failure(client.publicKeys().list());
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe('Request GET public_keys failed: ERR_DIDWW_CONNECT_TIMEOUT');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('limits the TLS handshake on the tunnel of a proxy agent', async () => {
    nock.restore();
    onTestFinished(() => nock.activate());
    raw = await RawServer.start(() => undefined);
    const port = raw.port;
    // Like https-proxy-agent: the tunnel is open, the TLS socket on it is handed over before its handshake.
    class TunnelAgent extends https.Agent {
      createConnection(_options: unknown, callback: (error: Error | null, socket: net.Socket) => void): undefined {
        const tunnel = net.connect(port, '127.0.0.1', () => callback(null, tls.connect({ socket: tunnel })));
        return undefined;
      }
    }
    const client = stubClient(
      { url: `https://127.0.0.1:${port}` },
      { agent: new TunnelAgent(), connectTimeout: 200, readTimeout: 5000 },
    );
    const start = Date.now();
    const error = await failure(client.publicKeys().list());
    expect(error.message).toBe('Request GET public_keys failed: ERR_DIDWW_CONNECT_TIMEOUT');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it.each([
    ['connect', { connect: 300 }, 'ERR_DIDWW_CONNECT_TIMEOUT'],
    ['total', { connect: null, total: 300 }, 'ERR_DIDWW_TOTAL_TIMEOUT'],
  ] as const)('settles the %s timeout of a request waiting for a socket of an agent', async (_kind, timeouts, code) => {
    nock.restore();
    onTestFinished(() => nock.activate());
    const s = (await startStub()).on('GET /slow', (_req, res) => {
      const timer = setTimeout(() => res.end('ok'), 1500);
      res.on('close', () => clearTimeout(timer));
    });
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    onTestFinished(() => agent.destroy());
    const transport = new Transport(agent, { connect: null, read: null, total: null }, 'test');
    const url = new URL(`${s.url}/slow`);
    const first = transport.send({ method: 'GET', url, headers: {} });
    void first.then(
      (res) => res.destroy(),
      () => undefined,
    );
    const start = Date.now();
    const error = await failure(transport.send({ method: 'GET', url, headers: {}, timeouts }));
    expect((error as TimeoutError).code).toBe(code);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  // The read timeout must hold on real sockets and on nock's (which tests of SDK users may load).
  describe.each(['nock sockets', 'real sockets'])('on %s', (mode) => {
    beforeEach(() => {
      if (mode === 'real sockets') {
        nock.restore();
        onTestFinished(() => nock.activate());
      }
    });

    it('limits the wait for the headers', async () => {
      const s = (await startStub()).on('GET /v3/public_keys', () => undefined);
      const error = await failure(stubClient(s, { readTimeout: 200 }).publicKeys().list());
      expect(error.message).toBe('Request GET public_keys failed: ERR_DIDWW_READ_TIMEOUT');
      expect((error.cause as TimeoutError).code).toBe('ERR_DIDWW_READ_TIMEOUT');
    });

    it('limits each wait for the body', async () => {
      const s = (await startStub()).on('GET /v3/public_keys', (_req, res) => {
        res.writeHead(200, { ...JSONAPI, 'Content-Length': '100' });
        res.write('{"data":');
      });
      const error = await failure(stubClient(s, { readTimeout: 200 }).publicKeys().list());
      expect(error.message).toBe('Request GET public_keys failed: ERR_DIDWW_READ_TIMEOUT');
    });

    it('limits the whole exchange with timeout', async () => {
      const s = (await startStub()).on('GET /v3/public_keys', (_req, res) => {
        res.writeHead(200, JSONAPI);
        const timer = setInterval(() => res.write(' '), 20);
        res.on('close', () => clearInterval(timer));
      });
      const error = await failure(stubClient(s, { readTimeout: 200, timeout: 300 }).publicKeys().list());
      expect(error.message).toBe('Request GET public_keys failed: ERR_DIDWW_TOTAL_TIMEOUT');
    });

    it('has no total limit by default', async () => {
      const s = (await startStub()).on('GET /v3/public_keys', (_req, res) => {
        res.writeHead(200, JSONAPI);
        let n = 0;
        const timer = setInterval(() => {
          if (++n < 10) {
            res.write(' ');
          } else {
            clearInterval(timer);
            res.end('{"data":[]}');
          }
        }, 50);
      });
      const result = await stubClient(s, { readTimeout: 200 }).publicKeys().list();
      expect(result.data).toEqual([]);
    });
  });
});

// The documented defaults; fake timers stand in for the long waits.
describe('default timeouts', () => {
  async function until(condition: () => boolean): Promise<void> {
    const limit = Date.now() + 5000;
    while (!condition()) {
      if (Date.now() > limit) throw new Error('timed out waiting for the condition');
      await new Promise((r) => setImmediate(r));
    }
  }

  async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  }

  function track<T>(promise: Promise<T>): { promise: Promise<T>; settled: () => boolean } {
    let settled = false;
    const tracked = promise.finally(() => {
      settled = true;
    });
    tracked.catch(() => undefined);
    return { promise: tracked, settled: () => settled };
  }

  function useFakeTimeouts(): void {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
  }

  it('allows 10 s to connect', async () => {
    nock.restore();
    onTestFinished(() => nock.activate());
    raw = await RawServer.start(() => undefined);
    useFakeTimeouts();
    const call = track(
      stubClient({ url: `https://127.0.0.1:${raw.port}` })
        .publicKeys()
        .list(),
    );
    await until(() => raw!.accepts === 1);
    await advance(9_999);
    expect(call.settled()).toBe(false);
    await advance(1);
    const error = await failure(call.promise);
    expect(error.message).toBe('Request GET public_keys failed: ERR_DIDWW_CONNECT_TIMEOUT');
  });

  it('allows 60 s for each read of the API and 10 s for a token request', async () => {
    nock.restore();
    onTestFinished(() => nock.activate());
    const s = (await startStub()).on('GET /v3/balance', { headers: JSONAPI, body: BALANCE_DOCUMENT });
    const setTimeoutSpy = vi.spyOn(http.ClientRequest.prototype, 'setTimeout');
    onTestFinished(() => setTimeoutSpy.mockRestore());
    await stubClient(s).balance().find();
    // The token request, then the API request.
    expect(setTimeoutSpy.mock.calls.map(([ms]) => ms)).toEqual([10_000, 60_000]);
  });

  it('allows a token request 10 s in all', async () => {
    const s = (await startStub()).on('POST /token', () => undefined);
    useFakeTimeouts();
    const call = track(stubClient(s).balance().find());
    await until(() => s.hits('POST /token').length === 1);
    await advance(9_999);
    expect(s.hits('POST /token')).toHaveLength(1);
    await advance(1);
    // The attempt that timed out is retried at once (the test sleep does not wait).
    // Each retry is let in before its 10 s pass, so a slow connect never turns it into a connect timeout.
    for (let attempt = 2; !call.settled(); attempt++) {
      await until(() => s.hits('POST /token').length >= attempt || call.settled());
      if (!call.settled()) await advance(10_000);
    }
    const error = await failure(call.promise);
    expect(error.message).toMatch(/ERR_DIDWW_TOTAL_TIMEOUT/);
  });

  it('allows a call to the token store 10 s', async () => {
    const s = (await startStub()).on('GET /v3/balance', { headers: JSONAPI, body: BALANCE_DOCUMENT });
    let reads = 0;
    const store: TokenStore = {
      get: () => {
        reads++;
        return new Promise(() => undefined);
      },
      set: () => undefined,
      delete: () => undefined,
    };
    useFakeTimeouts();
    const call = track(stubClient(s, { tokenStore: store }).balance().find());
    // The client reads the store, and once more before it mints.
    for (const read of [1, 2]) {
      await until(() => reads === read);
      await advance(9_999);
      expect(reads).toBe(read);
      expect(s.hits('POST /token')).toHaveLength(0);
      await advance(1);
    }
    await until(() => call.settled());
    await call.promise;
    expect(s.hits('POST /token')).toHaveLength(1);
  });

  it('allows 60 s for an error body when readTimeout is null', async () => {
    const s = (await startStub()).on('GET /v3/balance', (_req, res) => {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      const timer = setInterval(() => res.write('x'), 20);
      res.on('close', () => clearInterval(timer));
    });
    useFakeTimeouts();
    const client = stubClient(s, { readTimeout: null, tokenStore: seededTokenStore() });
    const call = track(client.balance().find());
    // The body deadline is the only timer left once the headers are in.
    await until(() => s.hits('GET /v3/balance').length === 1 && vi.getTimerCount() === 1);
    await advance(59_999);
    expect(call.settled()).toBe(false);
    await advance(1);
    const error = (await failure(call.promise)) as DidwwApiError;
    expect(error.status).toBe(503);
  });
});

describe('helpers', () => {
  const res = (headers: Record<string, string>) => ({ headers }) as unknown as http.IncomingMessage;

  it('reads Content-Length strictly', () => {
    expect(contentLength(res({ 'content-length': '42' }))).toBe(42);
    expect(contentLength(res({ 'content-length': ' 42\t' }))).toBe(42);
    expect(contentLength(res({ 'content-length': '4x' }))).toBeNull();
    expect(contentLength(res({ 'content-length': '1e3' }))).toBeNull();
    expect(contentLength(res({ 'content-length': '1'.repeat(16) }))).toBeNull();
    expect(contentLength(res({ 'content-length': '42', 'transfer-encoding': 'chunked' }))).toBeNull();
    expect(contentLength(res({}))).toBeNull();
  });

  it('checks a body that ended normally against its Content-Length', async () => {
    // node:http fails a body cut short on its own; this check is the fallback behind it.
    const short = Object.assign(Readable.from([Buffer.from('abc')]), {
      headers: { 'content-length': '10' },
      complete: true,
    }) as unknown as http.IncomingMessage;
    const error = await readAll(short, { strict: true }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(BodyReadError);
    expect((error as BodyReadError).incomplete).toBe(true);
    expect(((error as BodyReadError).cause as Error).message).toBe('the body ended before its Content-Length');
  });

  it('reads Retry-After as delay-seconds only', () => {
    expect(retryAfterSeconds('5')).toBe(5);
    expect(retryAfterSeconds(' 5 ')).toBe(5);
    expect(retryAfterSeconds('5.5')).toBeNull();
    expect(retryAfterSeconds('-1')).toBeNull();
    expect(retryAfterSeconds('1234567890')).toBeNull();
    expect(retryAfterSeconds('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
    expect(retryAfterSeconds(undefined)).toBeNull();
  });

  it('spreads a delay by up to a fifth, at least a second', () => {
    expect(spread(10, () => 0)).toBe(10);
    expect(spread(10, () => 0.5)).toBe(11);
    expect(spread(100, () => 0.5)).toBe(110);
  });

  it('draws random numbers in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const r = secureRandom();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('parses origins of http and https URLs without user info', () => {
    expect(originOf('https://API.example.com./v3/x?y=1')).toEqual({
      protocol: 'https:',
      host: 'api.example.com',
      port: 443,
    });
    expect(originOf('http://127.0.0.1:8080/x')).toEqual({ protocol: 'http:', host: '127.0.0.1', port: 8080 });
    for (const bad of [
      'ftp://h/x',
      'https://u:p@h/x',
      'https://@h/x',
      'https:\\\\h\\x',
      'https://h /x',
      'https:///x',
      '/x',
    ]) {
      expect(originOf(bad)).toBeNull();
    }
  });

  it('tells TLS failures from dropped connections', () => {
    const coded = (code: string, message = code) => Object.assign(new Error(message), { code });
    expect(isTlsFailure(coded('DEPTH_ZERO_SELF_SIGNED_CERT'))).toBe(true);
    expect(isTlsFailure(coded('ERR_TLS_CERT_ALTNAME_INVALID'))).toBe(true);
    expect(isTlsFailure(coded('ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE'))).toBe(true);
    expect(isTlsFailure(coded('EPROTO'))).toBe(true);
    expect(isTlsFailure(new Error('wrapped', { cause: coded('CERT_HAS_EXPIRED') }))).toBe(true);
    expect(isTlsFailure(coded('ECONNRESET', 'Client network socket disconnected before secure TLS connection'))).toBe(
      false,
    );
    expect(isTlsFailure(coded('EPROTO', 'unexpected eof while reading'))).toBe(false);
    expect(isTlsFailure(new Error('x', { cause: coded('ERR_DIDWW_CONNECT_TIMEOUT') }))).toBe(false);
    expect(isTlsFailure(new AggregateError([coded('ECONNREFUSED')]))).toBe(false);
    expect(isTlsFailure(coded('ECONNREFUSED'))).toBe(false);
  });
});
