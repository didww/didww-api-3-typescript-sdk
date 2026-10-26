import { randomBytes } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import type { AccessToken } from '../auth/access-token.js';

export type Method = 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE';

/** Milliseconds; null means no limit. */
export interface Timeouts {
  /** From the request until the connection (TLS included) is up. */
  connect: number | null;
  /** Inactivity of the connection: waiting for the headers and for each part of the body. */
  read: number | null;
  /** The whole exchange, body included. */
  total: number | null;
}

export interface SendOptions {
  method: Method;
  url: URL;
  headers: Record<string, string>;
  /** Always a Buffer, so the request can be sent again after a 401. */
  body?: Buffer;
  timeouts?: Partial<Timeouts>;
}

export interface Tokens {
  token(audience: string): Promise<AccessToken>;
  invalidate(audience: string, refusedAccessToken: string): Promise<void>;
}

/** The SDK's own connect, read or total timeout. */
export class TimeoutError extends Error {
  readonly code: string;

  constructor(kind: 'connect' | 'read' | 'total', ms: number) {
    super(`the ${kind} timeout of ${ms} ms expired`);
    this.name = 'TimeoutError';
    this.code = `ERR_DIDWW_${kind.toUpperCase()}_TIMEOUT`;
  }
}

/** `http.request` refused the request before sending anything (invalid URL, header or agent). */
export class RequestSetupError extends Error {
  readonly code: string;

  constructor(cause: unknown) {
    const code = errorCode(cause) ?? 'ERR_REQUEST_SETUP';
    super(`the request could not be sent (${code})`, { cause });
    this.name = 'RequestSetupError';
    this.code = code;
  }
}

interface Exchange {
  timedOut: TimeoutError | null;
  read: number | null;
}

const EXCHANGES = new WeakMap<http.IncomingMessage, Exchange>();

const noop = () => undefined;

/**
 * Sends requests with `node:http`/`node:https`. It never follows redirects,
 * decodes content, keeps cookies or retries; every timer stays referenced, so
 * a pending call keeps the process alive.
 */
export class Transport {
  readonly #agent: http.Agent | undefined;
  readonly #timeouts: Timeouts;
  readonly #userAgent: string;

  constructor(agent: http.Agent | undefined, timeouts: Timeouts, userAgent: string) {
    this.#agent = agent;
    this.#timeouts = timeouts;
    this.#userAgent = userAgent;
  }

  /** Sends one request; resolves with the response once its headers arrived. The caller reads or destroys it. */
  send(options: SendOptions, authorization?: string): Promise<http.IncomingMessage> {
    const timeouts = { ...this.#timeouts, ...options.timeouts };
    return new Promise((resolve, reject) => {
      const headers: http.OutgoingHttpHeaders = { 'User-Agent': this.#userAgent, ...options.headers };
      if (authorization !== undefined) headers.Authorization = authorization;
      const mod = options.url.protocol === 'https:' ? https : http;
      let req: http.ClientRequest;
      try {
        req = mod.request(options.url, { method: options.method, headers, agent: this.#agent });
      } catch (e) {
        reject(new RequestSetupError(e));
        return;
      }
      const exchange: Exchange = { timedOut: null, read: timeouts.read };
      // Rejects at once: a request queued in an agent with maxSockets reports its
      // destruction only when the agent hands it a socket.
      const expire = (error: TimeoutError) => {
        exchange.timedOut ??= error;
        connected();
        if (totalTimer) clearTimeout(totalTimer);
        req.destroy(error);
        reject(error);
      };

      // Started with the request, so that a proxy agent's tunnel counts as connecting.
      let connectTimer: NodeJS.Timeout | null = null;
      const connect = timeouts.connect;
      if (connect !== null) connectTimer = setTimeout(() => expire(new TimeoutError('connect', connect)), connect);
      const connected = () => {
        if (connectTimer) clearTimeout(connectTimer);
        connectTimer = null;
      };
      req.on('socket', (socket) => {
        // A proxy agent hands over a TLS socket on its open tunnel before the handshake with the target.
        const handshaking =
          socket instanceof tls.TLSSocket && !(socket as { _secureEstablished?: boolean })._secureEstablished;
        if (!socket.connecting && !handshaking) connected();
        else socket.once(socket instanceof tls.TLSSocket ? 'secureConnect' : 'connect', connected);
      });

      const read = timeouts.read;
      if (read !== null) req.setTimeout(read, () => expire(new TimeoutError('read', read)));

      const total = timeouts.total;
      const totalTimer = total !== null ? setTimeout(() => expire(new TimeoutError('total', total)), total) : null;

      req.on('close', () => {
        connected();
        if (totalTimer) clearTimeout(totalTimer);
      });
      req.on('error', (e) => reject(exchange.timedOut ?? e));
      req.on('response', (res) => {
        connected();
        res.on('error', noop);
        EXCHANGES.set(res, exchange);
        resolve(res);
      });
      req.end(options.body);
    });
  }

  /**
   * Sends a request with the access token of `audience` (none when null). A
   * 401 evicts the refused token and sends the request once more with a new
   * one; a second 401 evicts that one too and is returned. A 403 is returned as is.
   */
  async sendAuthorized(options: SendOptions, audience: string | null, tokens: Tokens): Promise<http.IncomingMessage> {
    if (audience === null) return this.send(options);
    const first = await tokens.token(audience);
    const res = await this.send(options, `Bearer ${first.accessToken}`);
    if (res.statusCode !== 401) return res;
    res.destroy();
    await tokens.invalidate(audience, first.accessToken);
    const second = await tokens.token(audience);
    const retried = await this.send(options, `Bearer ${second.accessToken}`);
    if (retried.statusCode === 401) await tokens.invalidate(audience, second.accessToken);
    return retried;
  }
}

/** The SDK timeout that ended the exchange of `res`, if any. */
export function timeoutOf(res: http.IncomingMessage): TimeoutError | null {
  return EXCHANGES.get(res)?.timedOut ?? null;
}

/** Stops the read timeout while the caller is busy with a chunk (a slow destination is not a stalled server). */
export function pauseReadTimer(res: http.IncomingMessage): void {
  const exchange = EXCHANGES.get(res);
  if (exchange?.read != null && typeof res.socket?.setTimeout === 'function') res.socket.setTimeout(0);
}

/** Restarts the read timeout; readers call it per chunk, as some sockets (mocks, wrappers) do not count reads as activity. */
export function resumeReadTimer(res: http.IncomingMessage): void {
  const exchange = EXCHANGES.get(res);
  if (exchange?.read != null && typeof res.socket?.setTimeout === 'function') res.socket.setTimeout(exchange.read);
}

/** The Content-Length of `res`, or null when absent, malformed or chunked. */
export function contentLength(res: http.IncomingMessage): number | null {
  const te = res.headers['transfer-encoding'];
  if (typeof te === 'string' && /chunked/i.test(te)) return null;
  const value = res.headers['content-length'];
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/^[ \t]+|[ \t]+$/g, '');
  return /^[0-9]{1,15}$/.test(trimmed) ? Number(trimmed) : null;
}

/** The delay-seconds of a Retry-After header, or null for an HTTP date or anything else. */
export function retryAfterSeconds(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/^[ \t]+|[ \t]+$/g, '');
  return /^[0-9]{1,9}$/.test(trimmed) ? Number(trimmed) : null;
}

/** `seconds` plus up to a fifth of it, or up to a second when that is more. */
export function spread(seconds: number, random: () => number): number {
  return seconds + random() * Math.max(1, seconds / 5);
}

/** A uniform number in [0, 1) from the operating system's CSPRNG. */
export function secureRandom(): number {
  return randomBytes(6).readUIntBE(0, 6) / 2 ** 48;
}

export interface Origin {
  protocol: string;
  host: string;
  port: number;
}

/** The origin of an absolute http or https URL without user info, or null. */
export function originOf(url: unknown): Origin | null {
  if (typeof url !== 'string' || /[\u0000- \u007f\\]/.test(url)) return null;
  if (!/^https?:\/\/[^/?#@]+(?:[/?#].*)?$/i.test(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname === '') return null;
  const protocol = parsed.protocol;
  const host = parsed.hostname.endsWith('.') ? parsed.hostname.slice(0, -1) : parsed.hostname;
  const port = parsed.port !== '' ? Number(parsed.port) : protocol === 'https:' ? 443 : 80;
  return { protocol, host, port };
}

export function sameOrigin(a: Origin | null, b: Origin | null): boolean {
  return a !== null && b !== null && a.protocol === b.protocol && a.host === b.host && a.port === b.port;
}

export function formatOrigin(o: Origin): string {
  return `${o.protocol}//${o.host}:${o.port}`;
}

const DROPPED_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ECONNABORTED',
  'ETIMEDOUT',
  'UND_ERR_SOCKET',
  'ERR_SSL_UNEXPECTED_EOF_WHILE_READING',
  'ERR_DIDWW_CONNECT_TIMEOUT',
  'ERR_DIDWW_READ_TIMEOUT',
  'ERR_DIDWW_TOTAL_TIMEOUT',
]);

const CERTIFICATE_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_CRL',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
  'CERT_SIGNATURE_FAILURE',
  'CRL_SIGNATURE_FAILURE',
  'CERT_NOT_YET_VALID',
  'CERT_HAS_EXPIRED',
  'CRL_NOT_YET_VALID',
  'CRL_HAS_EXPIRED',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD',
  'ERROR_IN_CERT_NOT_AFTER_FIELD',
  'ERROR_IN_CRL_LAST_UPDATE_FIELD',
  'ERROR_IN_CRL_NEXT_UPDATE_FIELD',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_CHAIN_TOO_LONG',
  'CERT_REVOKED',
  'INVALID_CA',
  'PATH_LENGTH_EXCEEDED',
  'INVALID_PURPOSE',
  'CERT_UNTRUSTED',
  'CERT_REJECTED',
  'HOSTNAME_MISMATCH',
]);

/** `error` and every error it wraps through `cause` and `AggregateError#errors`. */
export function errorChain(error: unknown): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  const stack = [error];
  while (stack.length > 0) {
    const e = stack.pop();
    if (e === null || typeof e !== 'object' || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
    stack.push((e as { cause?: unknown }).cause);
    if (e instanceof AggregateError) stack.push(...e.errors);
  }
  return out;
}

export function errorCode(error: unknown): string | undefined {
  const code = error !== null && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Whether `error` is a certificate or TLS protocol failure, which a retry
 * cannot fix. A connection dropped or timed out during the handshake is not one.
 */
export function isTlsFailure(error: unknown): boolean {
  const chain = errorChain(error);
  const dropped = chain.some((e) => {
    const code = errorCode(e);
    const message = e instanceof Error ? e.message.toLowerCase() : '';
    return (code !== undefined && DROPPED_CODES.has(code)) || message.includes('unexpected eof');
  });
  if (dropped) return false;
  return chain.some((e) => {
    const code = errorCode(e);
    return (
      code !== undefined &&
      (code === 'EPROTO' || code.startsWith('ERR_SSL_') || code.startsWith('ERR_TLS_') || CERTIFICATE_CODES.has(code))
    );
  });
}

/** A short name of a failure for messages: its code, or else its class name. */
export function describeFailure(error: unknown): string {
  for (const e of errorChain(error)) {
    const code = errorCode(e);
    if (code !== undefined) return code;
  }
  return error instanceof Error ? error.name : typeof error;
}
