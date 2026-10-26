import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import { DidwwClient } from '../src/client.js';
import { AccessToken } from '../src/auth/access-token.js';
import { MemoryTokenStore, DEFAULT_TOKEN_STORE, type TokenStore } from '../src/auth/token-store.js';
import { TokenProvider } from '../src/auth/token-provider.js';
import { Transport } from '../src/http/transport.js';
import { AuthErrorKind, DidwwAuthError } from '../src/errors.js';
import type { DidwwLogger } from '../src/logger.js';
import {
  BALANCE_DOCUMENT,
  JSONAPI,
  RawServer,
  StubServer,
  closedPort,
  stubClient,
  tokenReply,
  tokenSequence,
  type StubClientOptions,
} from './helpers/http-stub.js';

const FIXTURES = resolve(__dirname, 'fixtures', 'token');
const fixture = (name: string) => readFileSync(resolve(FIXTURES, name), 'utf8');
const API = 'api.didww.com';

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
  stub.on('GET /v3/balance', { status: 200, headers: JSONAPI, body: BALANCE_DOCUMENT });
  return stub;
}

function recordingLogger() {
  const lines: Array<{ level: string; message: string; details?: Record<string, unknown> }> = [];
  const logger: DidwwLogger = {
    debug: (message, details) => void lines.push({ level: 'debug', message, details }),
    warn: (message, details) => void lines.push({ level: 'warn', message, details }),
  };
  return { lines, logger };
}

function recordSleeps(): { sleeps: number[]; sleep: (ms: number) => Promise<void> } {
  const sleeps: number[] = [];
  return { sleeps, sleep: async (ms) => void sleeps.push(ms) };
}

async function capture(promise: Promise<unknown>): Promise<DidwwAuthError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DidwwAuthError);
  return error as DidwwAuthError;
}

function provider(url: string, options: { store?: TokenStore; scope?: string | null; logger?: DidwwLogger } = {}) {
  const transport = new Transport(undefined, { connect: 10_000, read: 10_000, total: null }, 'test');
  return new TokenProvider({
    transport,
    authUrl: url,
    apiKey: 'test-api-key',
    apiVersion: '2026-10-22',
    scope: options.scope ?? null,
    store: options.store ?? new MemoryTokenStore(),
    logger: options.logger ?? {},
    hooks: { sleep: async () => undefined },
  });
}

describe('token request', () => {
  it('sends the API key, the audience and the API version, and no expires_in', async () => {
    const s = (await startStub()).on('POST /token', tokenReply());
    await stubClient(s).balance().find();
    const [mint] = s.hits('POST /token');
    expect(JSON.parse(mint.body.toString())).toEqual(JSON.parse(fixture('create_request.json')));
    expect(mint.headers['api-key']).toBe('test-api-key');
    expect(mint.headers['content-type']).toBe('application/json');
    expect(mint.headers.accept).toBe('application/json');
    expect(mint.headers['accept-encoding']).toBe('identity');
    expect(mint.headers['user-agent']).toMatch(/^didww-typescript-sdk\//);
    expect(mint.headers.authorization).toBeUndefined();
  });

  it('sends the requested scope', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ scope: 'read' }));
    await stubClient(s, { scope: 'read' }).balance().find();
    expect(JSON.parse(s.hits('POST /token')[0].body.toString())).toEqual(
      JSON.parse(fixture('create_request_read_scope.json')),
    );
  });

  it('sends a later API version', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ api_version: '2027-01-01' }));
    await stubClient(s, { apiVersion: '2027-01-01' }).balance().find();
    expect(JSON.parse(s.hits('POST /token')[0].body.toString()).api_version).toBe('2027-01-01');
  });

  it('uses the granted token as bearer and never sends the API key to the API', async () => {
    const s = (await startStub()).on('POST /token', { status: 200, body: fixture('create.json') });
    await stubClient(s).balance().find();
    const [call] = s.hits('GET /v3/balance');
    expect(call.headers.authorization).toBe('Bearer test-access-token');
    expect(call.headers['api-key']).toBeUndefined();
    expect(call.headers['x-didww-api-version']).toBeUndefined();
  });
});

describe('caching', () => {
  it('reuses a token', async () => {
    const s = (await startStub()).on('POST /token', tokenReply());
    const client = stubClient(s);
    await client.balance().find();
    await client.balance().find();
    expect(s.hits('POST /token')).toHaveLength(1);
  });

  it('shares tokens through a store', async () => {
    const s = (await startStub()).on('POST /token', tokenReply());
    const store = new MemoryTokenStore();
    await stubClient(s, { tokenStore: store }).balance().find();
    await stubClient(s, { tokenStore: store }).balance().find();
    expect(s.hits('POST /token')).toHaveLength(1);
  });

  it('shares the default store across the process', async () => {
    const s = (await startStub()).on('POST /token', tokenReply());
    await stubClient(s, { tokenStore: undefined }).balance().find();
    await stubClient(s, { tokenStore: undefined }).balance().find();
    expect(s.hits('POST /token')).toHaveLength(1);
    expect(DEFAULT_TOKEN_STORE.size).toBe(1);
  });

  it('keeps a token for the granted lifetime', async () => {
    let now = 0;
    const store = new MemoryTokenStore({ now: () => now });
    const s = (await startStub()).on('POST /token', tokenSequence({ expires_in: 60 }));
    const client = stubClient(s, { tokenStore: store });
    await client.balance().find();
    now = 59_999;
    await client.balance().find();
    now = 60_000;
    await client.balance().find();
    expect(s.hits('POST /token')).toHaveLength(2);
    expect(s.hits('GET /v3/balance')[2].headers.authorization).toBe('Bearer access-token-2');
  });

  it('builds the cache key like the other SDKs', () => {
    const p = new TokenProvider({
      transport: new Transport(undefined, { connect: null, read: null, total: null }, 'test'),
      authUrl: 'https://auth.example.com',
      apiKey: 'key-1',
      apiVersion: '2026-10-22',
      scope: null,
      store: new MemoryTokenStore(),
      logger: {},
    });
    expect(p.cacheKey(API)).toBe('didww:token:v1:2e1c5435f0e67f91d34497fabf69840a945923a47982fad172c353b3f26be539');
  });

  it('treats a stored value that is not a token as a miss and warns', async () => {
    const s = (await startStub()).on('POST /token', tokenReply());
    const { lines, logger } = recordingLogger();
    const store: TokenStore = {
      get: () => ({ access_token: 'x' }) as unknown as AccessToken,
      set: () => undefined,
      delete: () => undefined,
    };
    await stubClient(s, { tokenStore: store, logger }).balance().find();
    expect(s.hits('POST /token')).toHaveLength(1);
    expect(lines.map((l) => l.message)).toContain('DIDWW token store read failed');
  });

  it('treats a stored token that is not a header value as a miss', async () => {
    const s = (await startStub()).on('POST /token', tokenReply());
    const store = new MemoryTokenStore();
    const client = stubClient(s, { tokenStore: store });
    const p = provider(s.url, { store });
    store.set(p.cacheKey(API), new AccessToken({ accessToken: 'bad\ntoken', aud: API }), 0);
    await client.balance().find();
    expect(s.hits('GET /v3/balance')[0].headers.authorization).toBe('Bearer access-token-1');
  });
});

describe('single flight', () => {
  it('shares one mint among concurrent callers', async () => {
    const s = (await startStub()).on('POST /token', { ...tokenReply(), delayMs: 100 });
    const client = stubClient(s);
    await Promise.all(Array.from({ length: 10 }, () => client.balance().find()));
    expect(s.hits('POST /token')).toHaveLength(1);
    expect(s.hits('GET /v3/balance')).toHaveLength(10);
  });

  it('shares the flight between clients of one store', async () => {
    const s = (await startStub()).on('POST /token', { ...tokenReply(), delayMs: 100 });
    const store = new MemoryTokenStore();
    await Promise.all([
      stubClient(s, { tokenStore: store }).balance().find(),
      stubClient(s, { tokenStore: store }).balance().find(),
    ]);
    expect(s.hits('POST /token')).toHaveLength(1);
  });

  it("gives every waiter the leader's error, and the next call mints again", async () => {
    const s = (await startStub()).on(
      'POST /token',
      { status: 401, body: fixture('invalid_client.json'), delayMs: 100 },
      tokenReply(),
    );
    const client = stubClient(s);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => client.balance().find()));
    const reasons = results.map((r) => (r as PromiseRejectedResult).reason);
    expect(new Set(reasons).size).toBe(1);
    expect(reasons[0]).toBeInstanceOf(DidwwAuthError);
    expect(s.hits('POST /token')).toHaveLength(1);
    await client.balance().find();
    expect(s.hits('POST /token')).toHaveLength(2);
  });
});

describe('token store failures', () => {
  const failing = (mode: 'throw' | 'reject' | 'hang'): TokenStore => {
    const fail = () => {
      if (mode === 'throw') throw new Error('store down');
      if (mode === 'reject') return Promise.reject(new Error('store down'));
      return new Promise<never>(() => undefined);
    };
    return { get: fail, set: fail, delete: fail } as unknown as TokenStore;
  };

  it.each(['throw', 'reject', 'hang'] as const)('logs and skips a store that fails (%s)', async (mode) => {
    const s = (await startStub()).on('POST /token', tokenReply());
    const { lines, logger } = recordingLogger();
    const client = stubClient(s, { tokenStore: failing(mode), logger, hooks: { storeTimeoutMs: 50 } });
    await client.balance().find();
    await client.balance().find();
    expect(s.hits('GET /v3/balance')).toHaveLength(2);
    expect(s.hits('POST /token')).toHaveLength(2);
    const messages = lines.map((l) => l.message);
    expect(messages).toContain('DIDWW token store read failed');
    expect(messages).toContain('DIDWW token store write failed');
  });

  it('logs a failing delete after a 401', async () => {
    const s = (await startStub()).on('POST /token', tokenSequence());
    s.on('GET /v3/balance', { status: 401 }, { status: 200, headers: JSONAPI, body: BALANCE_DOCUMENT });
    const { lines, logger } = recordingLogger();
    const inner = new MemoryTokenStore();
    const store: TokenStore = {
      get: (k) => inner.get(k),
      set: (k, t, ttl) => inner.set(k, t, ttl),
      delete: () => Promise.reject(new Error('delete failed')),
    };
    await stubClient(s, { tokenStore: store, logger }).balance().find();
    expect(lines.map((l) => l.message)).toContain('DIDWW token store delete failed');
    expect(s.hits('GET /v3/balance')[1].headers.authorization).toBe('Bearer access-token-2');
  });

  it('raises no unhandled rejection for a store that rejects after its timeout', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const s = (await startStub()).on('POST /token', tokenReply());
      const late = () => new Promise((_, reject) => setTimeout(() => reject(new Error('late')), 80));
      const store = { get: late, set: late, delete: late } as unknown as TokenStore;
      await stubClient(s, { tokenStore: store, hooks: { storeTimeoutMs: 20 } })
        .balance()
        .find();
      await new Promise((r) => setTimeout(r, 150));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});

describe('invalidation', () => {
  it('evicts the refused token', async () => {
    const s = await startStub();
    const store = new MemoryTokenStore();
    const p = provider(s.url, { store });
    store.set(p.cacheKey(API), new AccessToken({ accessToken: 'old', aud: API }), 0);
    await p.invalidate(API, 'old');
    expect(store.get(p.cacheKey(API))).toBeNull();
  });

  it('keeps a token minted by another caller', async () => {
    const s = await startStub();
    const store = new MemoryTokenStore();
    const p = provider(s.url, { store });
    const newer = new AccessToken({ accessToken: 'newer', aud: API });
    store.set(p.cacheKey(API), newer, 0);
    await p.invalidate(API, 'old');
    expect(store.get(p.cacheKey(API))).toBe(newer);
  });

  it.each([false, true])('never reuses a refused token that the store keeps (delete throws: %s)', async (throws) => {
    const s = (await startStub()).on('POST /token', tokenSequence());
    s.on('GET /v3/balance', { status: 401 }, { status: 200, headers: JSONAPI, body: BALANCE_DOCUMENT });
    const kept = new Map<string, AccessToken>();
    const store: TokenStore = {
      get: (k) => kept.get(k),
      set: (k, t) => void kept.set(k, t),
      delete: () => {
        if (throws) throw new Error('cannot delete');
      },
    };
    const client = stubClient(s, { tokenStore: store });
    await client.balance().find();
    await client.balance().find();
    const auths = s.hits('GET /v3/balance').map((r) => r.headers.authorization);
    expect(auths).toEqual(['Bearer access-token-1', 'Bearer access-token-2', 'Bearer access-token-2']);
    expect(s.hits('POST /token')).toHaveLength(2);
  });

  it('does not trust a refused token kept by the store before a new one was stored', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ access_token: 'new-token' }));
    const kept = new Map<string, AccessToken>();
    const store: TokenStore = { get: (k) => kept.get(k), set: (k, t) => void kept.set(k, t), delete: () => undefined };
    const p = provider(s.url, { store });
    kept.set(p.cacheKey(API), new AccessToken({ accessToken: 'old-token', aud: API }));
    await p.invalidate(API, 'old-token');
    expect((await p.token(API)).accessToken).toBe('new-token');
    expect((await p.token(API)).accessToken).toBe('new-token');
    expect(s.hits('POST /token')).toHaveLength(1);
  });
});

describe('error statuses', () => {
  it('reports a refused request', async () => {
    const s = (await startStub()).on('POST /token', { status: 400, body: fixture('invalid_scope.json') });
    const e = await capture(stubClient(s).balance().find());
    expect(e.kind).toBe(AuthErrorKind.INVALID_REQUEST);
    expect(e.status).toBe(400);
    expect(e.error).toBe('invalid_scope');
    expect(e.message).toBe('Token service: invalid_scope: scope is not a known scope');
  });

  it('does not retry an invalid client', async () => {
    const s = (await startStub()).on('POST /token', { status: 401, body: fixture('invalid_client.json') });
    const e = await capture(stubClient(s).balance().find());
    expect(e.kind).toBe(AuthErrorKind.INVALID_CLIENT);
    expect(e.errorDescription).toBe('Client authentication failed.');
    expect(s.hits('POST /token')).toHaveLength(1);
    expect(s.hits('GET /v3/balance')).toHaveLength(0);
  });

  it('does not follow a redirect', async () => {
    const s = (await startStub()).on('POST /token', { status: 307, headers: { Location: '/elsewhere' } });
    const e = await capture(stubClient(s).balance().find());
    expect(e.kind).toBe(AuthErrorKind.UNEXPECTED_STATUS);
    expect(e.errorDescription).toBe('the token request was redirected; redirects are not followed');
    expect(s.hits('POST /elsewhere')).toHaveLength(0);
  });

  it('reports another status as unexpected', async () => {
    const s = (await startStub()).on('POST /token', { status: 418, body: 'teapot' });
    const e = await capture(stubClient(s).balance().find());
    expect(e.kind).toBe(AuthErrorKind.UNEXPECTED_STATUS);
    expect(e.message).toBe('Token service responded with status 418');
  });

  it('reads at most 1 MiB of an error answer', async () => {
    const s = (await startStub()).on('POST /token', (_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      const chunk = Buffer.alloc(64 << 10, 0x20);
      const pump = () => {
        while (!res.destroyed && res.write(chunk));
      };
      res.on('drain', pump);
      pump();
    });
    const started = Date.now();
    const e = await capture(
      stubClient(s, { hooks: { mintTimeoutMs: 5000 } })
        .balance()
        .find(),
    );
    expect(e.kind).toBe(AuthErrorKind.INVALID_REQUEST);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('rate limit', () => {
  it('opens a window that blocks later mints without a request', async () => {
    let now = 1_000;
    const s = (await startStub()).on(
      'POST /token',
      { status: 429, headers: { 'Retry-After': '2' }, body: fixture('rate_limit_exceeded.json') },
      tokenReply(),
    );
    const client = stubClient(s, { hooks: { now: () => now, random: () => 0 } });
    const first = await capture(client.balance().find());
    expect(first.kind).toBe(AuthErrorKind.RATE_LIMITED);
    expect(first.status).toBe(429);
    expect(first.retryAfter).toBe(2);
    expect(first.error).toBe('rate_limit_exceeded');

    now += 1_500;
    const second = await capture(client.balance().find());
    expect(second.retryAfter).toBe(1);
    expect(second.error).toBe('rate_limit_exceeded');
    expect(s.hits('POST /token')).toHaveLength(1);

    now += 500;
    await client.balance().find();
    expect(s.hits('POST /token')).toHaveLength(2);
  });

  it('spreads the window', async () => {
    let now = 1_000;
    const s = (await startStub()).on('POST /token', { status: 429, headers: { 'Retry-After': '10' } }, tokenReply());
    const client = stubClient(s, { hooks: { now: () => now, random: () => 0.5 } });
    await capture(client.balance().find());
    now += 10_500;
    await capture(client.balance().find());
    expect(s.hits('POST /token')).toHaveLength(1);
    now += 500;
    await client.balance().find();
    expect(s.hits('POST /token')).toHaveLength(2);
  });

  it.each([
    ['0', 1],
    ['7', 7],
    [' 7 ', 7],
    ['Wed, 21 Oct 2026 07:28:00 GMT', 1],
    ['soon', 1],
    [undefined, 1],
  ])('reads Retry-After %j as %i seconds', async (header, seconds) => {
    const s = (await startStub()).on('POST /token', {
      status: 429,
      headers: header === undefined ? {} : { 'Retry-After': header },
    });
    const e = await capture(stubClient(s).balance().find());
    expect(e.retryAfter).toBe(seconds);
  });

  it('covers only clients of the same API key and token service', async () => {
    const s = (await startStub()).on('POST /token', { status: 429, headers: { 'Retry-After': '30' } }, tokenReply());
    await capture(stubClient(s).balance().find());
    await capture(stubClient(s).balance().find());
    await stubClient(s, { apiKey: 'other-key' }).balance().find();
    expect(s.hits('POST /token')).toHaveLength(2);
  });

  it('stops retrying when a window opened during the backoff', async () => {
    const s = (await startStub()).on('POST /token', { status: 503 }, { status: 429, headers: { 'Retry-After': '30' } });
    const other = stubClient(s, { tokenStore: new MemoryTokenStore() });
    const client = stubClient(s, {
      hooks: {
        sleep: async () => {
          await other
            .balance()
            .find()
            .catch(() => undefined);
        },
      },
    });
    const e = await capture(client.balance().find());
    expect(e.kind).toBe(AuthErrorKind.RATE_LIMITED);
    expect(e.status).toBe(429);
    expect(s.hits('POST /token')).toHaveLength(2);
  });
});

describe('retries', () => {
  it('retries a server error with a full-jitter backoff', async () => {
    const s = (await startStub()).on('POST /token', { status: 503 }, { status: 502 }, tokenReply());
    const { sleeps, sleep } = recordSleeps();
    await stubClient(s, { hooks: { sleep, random: () => 0.5 } })
      .balance()
      .find();
    expect(s.hits('POST /token')).toHaveLength(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('caps the backoff', () => {
    const p = new TokenProvider({
      transport: new Transport(undefined, { connect: null, read: null, total: null }, 'test'),
      authUrl: 'https://auth.example.com',
      apiKey: 'k',
      apiVersion: '2026-10-22',
      scope: null,
      store: new MemoryTokenStore(),
      logger: {},
      hooks: { random: () => 0.999 },
    });
    expect(p.backoffMs(1)).toBeLessThan(1000);
    expect(p.backoffMs(50)).toBeLessThan(8000);
    expect(p.backoffMs(50)).toBeGreaterThan(7900);
  });

  it('reports a server error once the attempts are used up', async () => {
    const s = (await startStub()).on('POST /token', { status: 500, body: fixture('server_error.json') });
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(stubClient(s, { hooks: { sleep } }).balance().find());
    expect(e.kind).toBe(AuthErrorKind.SERVER_ERROR);
    expect(e.status).toBe(500);
    expect(e.error).toBe('server_error');
    expect(s.hits('POST /token')).toHaveLength(4);
    expect(sleeps).toHaveLength(3);
  });

  it('retries an answer that does not come in time', async () => {
    const s = (await startStub()).on('POST /token', () => undefined);
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(
      stubClient(s, { hooks: { sleep, mintTimeoutMs: 100 } })
        .balance()
        .find(),
    );
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect(e.message).toMatch(/^Token service: ERR_DIDWW_(READ|TOTAL)_TIMEOUT: /);
    expect(s.hits('POST /token')).toHaveLength(4);
    expect(sleeps).toHaveLength(3);
  });

  it('limits the whole exchange, not only each read', async () => {
    const s = (await startStub()).on('POST /token', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const timer = setInterval(() => res.write(' '), 20);
      res.on('close', () => clearInterval(timer));
    });
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(
      stubClient(s, { hooks: { sleep, mintTimeoutMs: 200 } })
        .balance()
        .find(),
    );
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect(e.message).toBe('Token service: the token response could not be read (ERR_DIDWW_TOTAL_TIMEOUT)');
    expect(s.hits('POST /token')).toHaveLength(4);
    expect(sleeps).toHaveLength(3);
  });

  it('retries a refused connection and keeps the failure as cause', async () => {
    const port = await closedPort();
    const { sleeps, sleep } = recordSleeps();
    const client = stubClient({ url: `http://127.0.0.1:${port}` }, { hooks: { sleep } });
    const e = await capture(client.balance().find());
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect(e.status).toBeNull();
    expect(e.message).toMatch(/^Token service: ECONNREFUSED: /);
    expect((e.cause as { code?: string }).code).toBe('ECONNREFUSED');
    expect(sleeps).toHaveLength(3);
  });

  it('does not retry a request that cannot be sent', async () => {
    const s = await startStub();
    const { sleeps, sleep } = recordSleeps();
    const request = vi.spyOn(http, 'request').mockImplementation(() => {
      throw Object.assign(new TypeError('Invalid character in header content ["X"]'), { code: 'ERR_INVALID_CHAR' });
    });
    try {
      const e = await capture(stubClient(s, { hooks: { sleep } }).balance().find());
      expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
      expect(e.message).toBe('Token service: the token request could not be sent (ERR_INVALID_CHAR)');
      expect(e.cause).toBeUndefined();
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleeps).toEqual([]);
    } finally {
      request.mockRestore();
    }
  });
});

describe('TLS', () => {
  const tlsClient = (url: string, options: StubClientOptions = {}) => stubClient({ url }, options);

  it('does not retry a certificate error', async () => {
    stub = await StubServer.start({ tls: true });
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(tlsClient(stub.url, { hooks: { sleep } }).balance().find());
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect((e.cause as { code?: string }).code).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
    expect(stub.connections).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it('does not retry a TLS alert', async () => {
    raw = await RawServer.start((socket) =>
      socket.once('data', () => socket.end(Buffer.from('15030300020228', 'hex'))),
    );
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(tlsClient(`https://127.0.0.1:${raw.port}`, { hooks: { sleep } }).balance().find());
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect(raw.accepts).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it('does not retry plain HTTP on a TLS connection', async () => {
    raw = await RawServer.start((socket) =>
      socket.once('data', () => socket.end('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n')),
    );
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(tlsClient(`https://127.0.0.1:${raw.port}`, { hooks: { sleep } }).balance().find());
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect(raw.accepts).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it('retries a connection closed during the handshake', async () => {
    raw = await RawServer.start((socket) => socket.once('data', () => socket.end()));
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(tlsClient(`https://127.0.0.1:${raw.port}`, { hooks: { sleep } }).balance().find());
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect(e.message).toMatch(/^Token service: ECONNRESET: /);
    expect(raw.accepts).toBe(4);
    expect(sleeps).toHaveLength(3);
  });
});

describe('grant', () => {
  it.each([
    ['another audience', tokenReply({ aud: ['api-vin.didww.com'] })],
    ['no audience', tokenReply({ aud: [] })],
    ['an empty token', tokenReply({ access_token: '' })],
    ['a token with a space', tokenReply({ access_token: 'has space' })],
    ['a token with a line break', tokenReply({ access_token: 'line\nbreak' })],
    ['a token outside ASCII', tokenReply({ access_token: 'café' })],
    ['a body that is not JSON', { status: 200, body: 'not json' }],
    ['a JSON array', { status: 200, body: '[1, 2]' }],
  ])('refuses and does not cache %s', async (_name, reply) => {
    const s = (await startStub()).on('POST /token', reply);
    const client = stubClient(s);
    for (let i = 0; i < 2; i++) {
      const e = await capture(client.balance().find());
      expect(e.kind).toBe(AuthErrorKind.INVALID_GRANT);
      expect(e.status).toBe(200);
    }
    expect(s.hits('POST /token')).toHaveLength(2);
    expect(s.hits('GET /v3/balance')).toHaveLength(0);
  });

  it('names the granted and requested audiences', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ aud: 'api-vin.didww.com' }));
    const e = await capture(stubClient(s).balance().find());
    expect(e.message).toBe('Token service: granted audience ["api-vin.didww.com"], requested api.didww.com');
  });

  it('retries a token answer cut short and never exposes the token', async () => {
    const secret = 'cut-secret-token-123';
    raw = await RawServer.start((socket) =>
      socket.once('data', () =>
        socket.end(
          'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n' +
            `{"access_token":"${secret}","aud":["api.didww.com"]`,
        ),
      ),
    );
    const { sleeps, sleep } = recordSleeps();
    const e = await capture(stubClient({ url: raw.url }, { hooks: { sleep } }).balance().find());
    expect(e.kind).toBe(AuthErrorKind.CONNECTION_ERROR);
    expect(e.status).toBe(200);
    expect(e.message).toBe('Token service: the token response could not be read (ECONNRESET)');
    expect(e.cause).toBeUndefined();
    expect(raw.accepts).toBe(4);
    expect(sleeps).toHaveLength(3);
    for (const text of [String(e), inspect(e, { depth: 10 }), JSON.stringify(e), e.stack ?? '']) {
      expect(text).not.toContain(secret);
    }
  });

  it('keeps the expiry, scope and API version of the grant', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ expires_in: 123, scope: 'read' }));
    const store = new MemoryTokenStore();
    await stubClient(s, { tokenStore: store, scope: 'read' }).balance().find();
    const token = store.get(provider(s.url, { store, scope: 'read' }).cacheKey(API));
    expect(token?.expiresIn).toBe(123);
    expect(token?.scope).toBe('read');
    expect(token?.apiVersion).toBe('2026-10-22');
    expect(token?.mintedAt).toBeInstanceOf(Date);
  });
});

describe('logging', () => {
  it('warns about a scope mismatch', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ scope: 'full' }));
    const { lines, logger } = recordingLogger();
    await stubClient(s, { scope: 'read', logger }).balance().find();
    expect(lines).toContainEqual({
      level: 'warn',
      message: 'DIDWW token scope mismatch: requested read, granted full',
      details: undefined,
    });
  });

  it('warns about an API version mismatch', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ api_version: '2027-01-01' }));
    const { lines, logger } = recordingLogger();
    await stubClient(s, { logger }).balance().find();
    expect(lines.map((l) => l.message)).toContain(
      'DIDWW token api_version mismatch: requested 2026-10-22, granted 2027-01-01',
    );
  });

  it('does not warn when the grant matches, nor about scope when none was requested', async () => {
    const s = (await startStub()).on('POST /token', tokenReply({ scope: 'read' }));
    const { lines, logger } = recordingLogger();
    await stubClient(s, { logger }).balance().find();
    expect(lines.filter((l) => l.level === 'warn')).toEqual([]);
  });

  it('logs the mint at debug level without secrets', async () => {
    const s = (await startStub()).on('POST /token', tokenReply());
    const { lines, logger } = recordingLogger();
    await stubClient(s, { logger }).balance().find();
    const debug = lines.filter((l) => l.level === 'debug');
    expect(debug).toHaveLength(1);
    expect(debug[0].message).toMatch(
      /^DIDWW token minted: aud \["api.didww.com"\], scope full, api_version 2026-10-22, expires_in 900, duration_ms \d+$/,
    );
    expect(JSON.stringify(lines)).not.toContain('access-token-1');
    expect(JSON.stringify(lines)).not.toContain('test-api-key');
  });

  it('never fails a call because of the logger', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const s = (await startStub()).on('POST /token', tokenReply({ api_version: '2027-01-01' }));
      const throwing: DidwwLogger = {
        debug: () => {
          throw new Error('logger down');
        },
        warn: () => Promise.reject(new Error('logger down')),
      };
      await stubClient(s, { logger: throwing }).balance().find();
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('is silent by default', async () => {
    const spies = (['log', 'debug', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const s = (await startStub()).on('POST /token', tokenReply({ api_version: '2027-01-01', scope: 'x' }));
      await new DidwwClient({
        apiKey: 'test-api-key',
        baseUrl: `${s.url}/v3`,
        authUrl: s.url,
        tokenStore: new MemoryTokenStore(),
        scope: 'read',
      })
        .balance()
        .find();
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
