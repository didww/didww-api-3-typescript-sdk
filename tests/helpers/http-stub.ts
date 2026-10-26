import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DidwwClient, type DidwwClientOptions } from '../../src/client.js';
import { TESTING, type TestingHooks } from '../../src/auth/state.js';
import { MemoryTokenStore } from '../../src/auth/token-store.js';
import { DEFAULT_API_VERSION } from '../../src/configuration.js';

let testTls: { key: Buffer; cert: Buffer } | null = null;

/** A fresh self-signed certificate for 127.0.0.1, only for tests: clients refuse it. Made on first use, as it needs openssl. */
export function testTlsCertificate(): { key: Buffer; cert: Buffer } {
  return (testTls ??= selfSignedCertificate());
}

function selfSignedCertificate(): { key: Buffer; cert: Buffer } {
  const dir = mkdtempSync(join(tmpdir(), 'didww-tls-'));
  try {
    execFileSync(
      'openssl',
      ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes']
        .concat(['-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'), '-days', '1'])
        .concat(['-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1']),
      { stdio: 'ignore' },
    );
    return { key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

export interface CannedReply {
  status?: number;
  headers?: Record<string, string | string[]>;
  body?: string | Buffer | object;
  /** Milliseconds to wait before answering. */
  delayMs?: number;
}

export type Handler = (req: RecordedRequest, res: http.ServerResponse) => void | Promise<void>;
export type Reply = CannedReply | Handler;

/**
 * A local HTTP(S) server with scripted replies per `METHOD /path`. Replies
 * are used in order; the last one repeats. Every request is recorded.
 */
export class StubServer {
  readonly requests: RecordedRequest[] = [];
  /** TCP connections accepted, TLS handshakes that failed included. */
  connections = 0;
  readonly #routes = new Map<string, Reply[]>();
  readonly #server: http.Server;
  url = '';

  private constructor(server: http.Server) {
    this.#server = server;
    server.on('connection', () => this.connections++);
    server.on('request', (req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const path = (req.url ?? '/').split('?')[0];
        const recorded: RecordedRequest = {
          method: req.method ?? '',
          path: req.url ?? '/',
          headers: req.headers,
          body: Buffer.concat(chunks),
        };
        this.requests.push(recorded);
        const replies = this.#routes.get(`${recorded.method} ${path}`);
        const reply = replies && replies.length > 1 ? replies.shift() : replies?.[0];
        void this.#answer(reply, recorded, res);
      });
    });
  }

  static async start(options: { tls?: boolean } = {}): Promise<StubServer> {
    const server = options.tls ? https.createServer(testTlsCertificate()) : http.createServer();
    const stub = new StubServer(server);
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const { port } = server.address() as net.AddressInfo;
    stub.url = `${options.tls ? 'https' : 'http'}://127.0.0.1:${port}`;
    return stub;
  }

  on(route: string, ...replies: Reply[]): this {
    this.#routes.set(route, replies);
    return this;
  }

  /** The requests sent to `METHOD /path` (query ignored). */
  hits(route: string): RecordedRequest[] {
    return this.requests.filter((r) => `${r.method} ${r.path.split('?')[0]}` === route);
  }

  async #answer(reply: Reply | undefined, req: RecordedRequest, res: http.ServerResponse): Promise<void> {
    if (reply === undefined) {
      res.writeHead(599, { 'Content-Type': 'text/plain' }).end(`no stub for ${req.method} ${req.path}`);
      return;
    }
    if (typeof reply === 'function') {
      await reply(req, res);
      return;
    }
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    const body =
      reply.body === undefined
        ? Buffer.alloc(0)
        : Buffer.isBuffer(reply.body)
          ? reply.body
          : Buffer.from(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
    const headers: Record<string, string | string[]> = { 'Content-Length': String(body.length), ...reply.headers };
    if (reply.body !== undefined && typeof reply.body === 'object' && !Buffer.isBuffer(reply.body)) {
      headers['Content-Type'] ??= 'application/json';
    }
    if (res.destroyed) return;
    res.writeHead(reply.status ?? 200, headers).end(body);
  }

  async close(): Promise<void> {
    this.#server.closeAllConnections();
    await new Promise<void>((done) => this.#server.close(() => done()));
  }
}

/** A TCP server that hands every connection to `handler` and counts them. */
export class RawServer {
  accepts = 0;
  port = 0;
  readonly #server: net.Server;
  readonly #sockets = new Set<net.Socket>();

  private constructor(handler: (socket: net.Socket) => void) {
    this.#server = net.createServer((socket) => {
      this.accepts++;
      this.#sockets.add(socket);
      socket.on('error', () => undefined);
      socket.on('close', () => this.#sockets.delete(socket));
      handler(socket);
    });
  }

  static async start(handler: (socket: net.Socket) => void): Promise<RawServer> {
    const raw = new RawServer(handler);
    await new Promise<void>((done) => raw.#server.listen(0, '127.0.0.1', done));
    raw.port = (raw.#server.address() as net.AddressInfo).port;
    return raw;
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async close(): Promise<void> {
    for (const socket of this.#sockets) socket.destroy();
    await new Promise<void>((done) => this.#server.close(() => done()));
  }
}

/** A port nothing listens on. */
export async function closedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}

export function tokenReply(overrides: Record<string, unknown> = {}, status = 200): CannedReply {
  return {
    status,
    body: {
      access_token: 'access-token-1',
      token_type: 'Bearer',
      expires_in: 900,
      aud: ['api.didww.com'],
      scope: 'full',
      api_version: DEFAULT_API_VERSION,
      ...overrides,
    },
  };
}

/** Replies with a new token per call: access-token-1, access-token-2, ... */
export function tokenSequence(overrides: Record<string, unknown> = {}): Handler {
  let n = 0;
  return (_req, res) => {
    n++;
    const body = JSON.stringify(tokenReply({ access_token: `access-token-${n}`, ...overrides }).body);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  };
}

export const JSONAPI = { 'Content-Type': 'application/vnd.api+json' };

export const BALANCE_DOCUMENT = {
  data: {
    id: 'b1',
    type: 'balances',
    attributes: { total_balance: '10.00', balance: '10.00', credit: '0.00' },
  },
};

export interface StubClientOptions extends Partial<DidwwClientOptions> {
  hooks?: TestingHooks;
}

/** A client whose API, token service and prices services all point at `stub`, with a fresh token store. */
export function stubClient(stub: { url: string }, options: StubClientOptions = {}): DidwwClient {
  const { hooks, ...rest } = options;
  return new DidwwClient({
    apiKey: 'test-api-key',
    baseUrl: `${stub.url}/v3`,
    authUrl: stub.url,
    voiceInPricesUrl: `${stub.url}/v3`,
    voiceOutPricesUrl: `${stub.url}/v3`,
    smsPricesUrl: `${stub.url}/v3`,
    tokenStore: new MemoryTokenStore(),
    ...rest,
    [TESTING]: { sleep: async () => undefined, ...hooks },
  } as DidwwClientOptions);
}
