import { describe, it, expect, afterEach, beforeEach, onTestFinished } from 'vitest';
import { createWriteStream, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import nock from 'nock';
import { DidwwApiError, DidwwClientError } from '../src/errors.js';
import { Environment } from '../src/configuration.js';
import { seededTokenStore } from './helpers/client.js';
import { paddedGzipInThreeParts } from './helpers/gzip.js';
import { RawServer, StubServer, stubClient, tokenSequence } from './helpers/http-stub.js';

const CSV = 'Date/Time Start (UTC),Source\n2026-10-22 00:00:00,972397239159652\n';
const GZ = gzipSync(CSV);
const PATH = '/v3/exports/e1.csv.gz';

let stub: StubServer | null = null;
let raw: RawServer | null = null;
let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'didww-export-'));
});

afterEach(async () => {
  await stub?.close();
  await raw?.close();
  stub = null;
  raw = null;
  rmSync(dir, { recursive: true, force: true });
});

async function startStub(...replies: Parameters<StubServer['on']>[1][]): Promise<StubServer> {
  stub = await StubServer.start();
  stub.on('POST /token', tokenSequence());
  if (replies.length > 0) stub.on(`GET ${PATH}`, ...replies);
  return stub;
}

const fileReply = (body: Buffer = GZ, headers: Record<string, string> = {}) => ({
  status: 200,
  headers: { 'Content-Type': 'application/octet-stream', ...headers },
  body,
});

async function failure(promise: Promise<unknown>): Promise<Error> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(Error);
  return error as Error;
}

function cutServer(head: string, body: Buffer): Promise<RawServer> {
  return RawServer.start((socket) =>
    socket.once('data', () => {
      socket.write(head);
      socket.end(body);
    }),
  );
}

const leftovers = () => readdirSync(dir).filter((f) => f.endsWith('.tmp'));

describe('downloadExport', () => {
  it('returns the file unchanged', async () => {
    const s = await startStub(fileReply());
    const buffer = await stubClient(s).downloadExport(`${s.url}${PATH}`);
    expect(buffer.equals(GZ)).toBe(true);
    const [call] = s.hits(`GET ${PATH}`);
    expect(call.headers.authorization).toBe('Bearer access-token-1');
    expect(call.headers['accept-encoding']).toBe('identity');
  });

  it('writes the file to a path', async () => {
    const s = await startStub(fileReply());
    const dest = join(dir, 'export.csv.gz');
    await stubClient(s).downloadExport(`${s.url}${PATH}`, dest);
    expect(readFileSync(dest).equals(GZ)).toBe(true);
    expect(leftovers()).toEqual([]);
  });

  it('does not decode a content coding', async () => {
    const s = await startStub(fileReply(GZ, { 'Content-Encoding': 'gzip' }));
    const buffer = await stubClient(s).downloadExport(`${s.url}${PATH}`);
    expect(buffer.equals(GZ)).toBe(true);
  });

  it('writes to a stream and leaves it open', async () => {
    const s = await startStub(fileReply());
    const sink = new PassThrough();
    const chunks: Buffer[] = [];
    sink.on('data', (c: Buffer) => chunks.push(c));
    await stubClient(s).downloadExport(`${s.url}${PATH}`, sink);
    expect(Buffer.concat(chunks).equals(GZ)).toBe(true);
    expect(sink.writableEnded).toBe(false);
    expect(sink.listenerCount('error')).toBe(0);
  });

  it('replaces an existing file', async () => {
    const s = await startStub(fileReply());
    const dest = join(dir, 'export.csv.gz');
    writeFileSync(dest, 'old');
    await stubClient(s).downloadExport(`${s.url}${PATH}`, dest);
    expect(readFileSync(dest).equals(GZ)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('creates the file with 0666 minus the umask', async () => {
    const s = await startStub(fileReply());
    const client = stubClient(s);
    for (const [umask, mode] of [
      [0o002, 0o664],
      [0o027, 0o640],
      [0o022, 0o644],
    ]) {
      const previous = process.umask(umask);
      try {
        const dest = join(dir, `mode-${umask}.csv.gz`);
        await client.downloadExport(`${s.url}${PATH}`, dest);
        expect(statSync(dest).mode & 0o777).toBe(mode);
      } finally {
        process.umask(previous);
      }
    }
  });

  it('uses its own temporary file per download', async () => {
    const s = await startStub({ ...fileReply(), delayMs: 50 });
    const client = stubClient(s);
    const dest = join(dir, 'export.csv.gz');
    await Promise.all([client.downloadExport(`${s.url}${PATH}`, dest), client.downloadExport(`${s.url}${PATH}`, dest)]);
    expect(readFileSync(dest).equals(GZ)).toBe(true);
    expect(leftovers()).toEqual([]);
  });

  it('fails for a missing directory before any request', async () => {
    const s = await startStub(fileReply());
    const error = await failure(stubClient(s).downloadExport(`${s.url}${PATH}`, join(dir, 'missing', 'x.csv.gz')));
    expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    expect(s.requests).toHaveLength(0);
  });

  it('refuses a destination that is neither a path nor a stream', async () => {
    const s = await startStub(fileReply());
    await expect(stubClient(s).downloadExport(`${s.url}${PATH}`, 42 as never)).rejects.toBeInstanceOf(TypeError);
    expect(s.requests).toHaveLength(0);
  });

  it('retries after a 401 without writing the 401 body', async () => {
    const s = await startStub({ status: 401, body: 'refused' }, fileReply());
    const sink = new PassThrough();
    const chunks: Buffer[] = [];
    sink.on('data', (c: Buffer) => chunks.push(c));
    await stubClient(s).downloadExport(`${s.url}${PATH}`, sink);
    expect(Buffer.concat(chunks).equals(GZ)).toBe(true);
    expect(s.hits('POST /token')).toHaveLength(2);
  });
});

describe('export URL origin', () => {
  it('refuses another origin without a request', async () => {
    const s = await startStub(fileReply());
    const client = stubClient(s);
    for (const url of [
      `https://evil.example.com${PATH}`,
      `${s.url.replace('127.0.0.1', 'localhost')}${PATH}`,
      `${s.url.replace('http:', 'https:')}${PATH}`,
      `http://user:secret@127.0.0.1${PATH}`,
      `${s.url}\\v3\\x`,
      ` ${s.url}${PATH}`,
      'ftp://127.0.0.1/x',
      'not a url',
    ]) {
      const error = await failure(client.downloadExport(url));
      expect(error).toBeInstanceOf(DidwwClientError);
      expect(error.message).not.toContain('secret');
    }
    expect(s.requests).toHaveLength(0);
  });

  it('names the origins in the message', async () => {
    const s = await startStub();
    const error = await failure(stubClient(s).downloadExport(`https://evil.example.com:8443${PATH}?a=b`));
    expect(error.message).toBe(
      `Export URL https://evil.example.com:8443 does not match the API base URL ${s.url}` +
        ` or the environment URL https://sandbox-api.didww.com:443`,
    );
  });

  it('accepts the environment origin with a custom base URL', async () => {
    const s = await startStub();
    const scope = nock('https://sandbox-api.didww.com').get(PATH).reply(200, GZ);
    const buffer = await stubClient(s).downloadExport(`https://sandbox-api.didww.com${PATH}`);
    expect(buffer.equals(GZ)).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it('accepts a host with a trailing dot and an upper-case host', async () => {
    nock('https://api.didww.com.').get(PATH).reply(200, GZ);
    nock('https://api.didww.com').get(PATH).reply(200, GZ);
    const client = stubClient(
      { url: 'http://127.0.0.1:1' },
      { environment: Environment.PRODUCTION, baseUrl: 'https://api.didww.com/v3', tokenStore: seededTokenStore() },
    );
    expect((await client.downloadExport(`https://api.didww.com.${PATH}`)).equals(GZ)).toBe(true);
    expect((await client.downloadExport(`https://API.didww.com${PATH}`)).equals(GZ)).toBe(true);
  });
});

describe('export status', () => {
  it.each([204, 302, 404, 500])('writes only a 200 (%i gives an API error)', async (status) => {
    const s = await startStub({
      status,
      headers: { Location: '/elsewhere' },
      body: status === 204 ? undefined : { errors: [{ detail: `status ${status}` }] },
    });
    const dest = join(dir, 'export.csv.gz');
    writeFileSync(dest, 'old');
    const error = await failure(stubClient(s).downloadExport(`${s.url}${PATH}`, dest));
    expect(error).toBeInstanceOf(DidwwApiError);
    expect((error as DidwwApiError).status).toBe(status);
    if (status !== 204) expect(error.message).toBe(`status ${status}`);
    expect(readFileSync(dest, 'utf8')).toBe('old');
    expect(leftovers()).toEqual([]);
    expect(s.hits('GET /elsewhere')).toHaveLength(0);
  });
});

describe('export failures', () => {
  it('reports a body cut short and keeps the destination', async () => {
    raw = await cutServer('HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n', GZ);
    const client = stubClient({ url: raw.url }, { tokenStore: seededTokenStore() });
    const dest = join(dir, 'export.csv.gz');
    writeFileSync(dest, 'old');
    const error = await failure(client.downloadExport(`${raw.url}${PATH}`, dest));
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe('Export data is incomplete');
    expect(readFileSync(dest, 'utf8')).toBe('old');
    expect(leftovers()).toEqual([]);
  });

  it('reports a body shorter than its Content-Length on nock sockets', async () => {
    nock('https://sandbox-api.didww.com')
      .get(PATH)
      .reply(200, GZ, { 'Content-Length': String(GZ.length + 10) });
    const client = stubClient(
      { url: 'http://127.0.0.1:1' },
      { baseUrl: 'https://sandbox-api.didww.com/v3', tokenStore: seededTokenStore() },
    );
    const error = await failure(client.downloadExport(`https://sandbox-api.didww.com${PATH}`));
    expect(error.message).toMatch(/^Export data is incomplete/);
  });

  it('reports a body that stalls', async () => {
    const s = await startStub((_req, res) => {
      res.writeHead(200, { 'Content-Length': '1000' });
      res.write(GZ);
    });
    const error = await failure(stubClient(s, { readTimeout: 200 }).downloadExport(`${s.url}${PATH}`));
    expect(error.message).toBe('Failed to read export data: ERR_DIDWW_READ_TIMEOUT');
  });

  it.each([
    ['at once', (fail: () => void) => fail()],
    ['from a promise', (fail: () => void) => void Promise.resolve().then(fail)],
  ])('propagates a write error of the destination reported %s without crashing', async (_name, report) => {
    const s = await startStub(fileReply());
    const failing = new Writable({
      write(_chunk, _encoding, callback) {
        report(() => callback(Object.assign(new Error('disk full'), { code: 'ENOSPC' })));
      },
    });
    const error = await failure(stubClient(s).downloadExport(`${s.url}${PATH}`, failing));
    expect((error as NodeJS.ErrnoException).code).toBe('ENOSPC');
    await new Promise((r) => setTimeout(r, 20));
    expect(failing.listenerCount('error')).toBe(0);
  });

  it.each([
    ['a 200', fileReply()],
    ['a 404', { status: 404, body: { errors: [{ detail: 'status 404' }] } }],
  ])('propagates the error a stream emits on its own on %s', async (_name, reply) => {
    const s = await startStub({ ...reply, delayMs: 50 });
    const out = createWriteStream(join(dir, 'missing', 'export.csv.gz'));
    const error = await failure(stubClient(s).downloadExport(`${s.url}${PATH}`, out));
    expect(error).not.toBeInstanceOf(DidwwClientError);
    expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    expect(out.listenerCount('error')).toBe(0);
  });

  it('removes its error listener after an API error', async () => {
    const s = await startStub({ status: 404, body: { errors: [{ detail: 'status 404' }] } });
    const sink = new PassThrough();
    const error = await failure(stubClient(s).downloadExport(`${s.url}${PATH}`, sink));
    expect(error).toBeInstanceOf(DidwwApiError);
    expect(sink.listenerCount('error')).toBe(0);
  });

  it('writes to an object with only write', async () => {
    const s = await startStub(fileReply());
    const chunks: Buffer[] = [];
    const dest = {
      write(chunk: Buffer, callback: () => void) {
        chunks.push(chunk);
        callback();
        return true;
      },
    };
    await stubClient(s).downloadExport(`${s.url}${PATH}`, dest as never);
    expect(Buffer.concat(chunks).equals(GZ)).toBe(true);
  });

  it.each([
    ['a 200', fileReply()],
    [
      'an error status',
      { status: 404, headers: { 'Content-Type': 'application/vnd.api+json' }, body: '{"errors":[]}' },
    ],
  ])('refuses a closed destination before the request that would get %s', async (_status, reply) => {
    const s = await startStub(reply);
    const ended = new PassThrough();
    ended.end();
    const error = await failure(stubClient(s).downloadExport(`${s.url}${PATH}`, ended));
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe('the destination stream is closed');
    expect(s.requests).toHaveLength(0);
  });

  it('rejects with the error of a destination that already failed, before any request', async () => {
    const s = await startStub(fileReply());
    const failed = new PassThrough();
    failed.on('error', () => undefined);
    const cause = Object.assign(new Error('disk'), { code: 'EIO' });
    failed.destroy(cause);
    const error = await failure(stubClient(s).downloadExport(`${s.url}${PATH}`, failed));
    expect(error).toBe(cause);
    expect(s.requests).toHaveLength(0);
  });

  it('does not count a slow destination as a stalled server', async () => {
    // On nock's sockets a paused body is cut; real sockets show the behaviour.
    nock.restore();
    onTestFinished(() => nock.activate());
    const body = Buffer.alloc(2 << 20, 7);
    const s = await startStub(fileReply(body));
    let first = true;
    let written = 0;
    const slow = new Writable({
      highWaterMark: 1024,
      write(chunk: Buffer, _encoding, callback) {
        written += chunk.length;
        if (first) {
          first = false;
          setTimeout(callback, 400);
        } else {
          callback();
        }
      },
    });
    await stubClient(s, { readTimeout: 150 }).downloadExport(`${s.url}${PATH}`, slow);
    expect(written).toBe(body.length);
  });
});

describe('downloadAndDecompressExport', () => {
  it('returns the CSV', async () => {
    const s = await startStub(fileReply());
    const buffer = await stubClient(s).downloadAndDecompressExport(`${s.url}${PATH}`);
    expect(buffer.toString()).toBe(CSV);
  });

  it('writes the CSV to a path and to a stream', async () => {
    const s = await startStub(fileReply());
    const client = stubClient(s);
    const dest = join(dir, 'export.csv');
    await client.downloadAndDecompressExport(`${s.url}${PATH}`, dest);
    expect(readFileSync(dest, 'utf8')).toBe(CSV);
    const sink = new PassThrough();
    const chunks: Buffer[] = [];
    sink.on('data', (c: Buffer) => chunks.push(c));
    await client.downloadAndDecompressExport(`${s.url}${PATH}`, sink);
    expect(Buffer.concat(chunks).toString()).toBe(CSV);
  });

  it('reads a multi-member gzip file in full', async () => {
    const s = await startStub(fileReply(Buffer.concat([gzipSync('a,b\n'), gzipSync('c,d\n')])));
    const buffer = await stubClient(s).downloadAndDecompressExport(`${s.url}${PATH}`);
    expect(buffer.toString()).toBe('a,b\nc,d\n');
  });

  it.each([
    ['data that is not gzip', Buffer.from('plain,csv\n')],
    ['a later member cut short', Buffer.concat([gzipSync('a,b\n'), gzipSync('c,d\n').subarray(0, 12)])],
    ['trailing garbage', Buffer.concat([GZ, Buffer.from('junk')])],
  ])('fails to decompress %s and keeps the destination', async (_name, body) => {
    const s = await startStub(fileReply(body));
    const dest = join(dir, 'export.csv');
    writeFileSync(dest, 'old');
    const error = await failure(stubClient(s).downloadAndDecompressExport(`${s.url}${PATH}`, dest));
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe('Failed to decompress export data');
    expect(error.cause).toBeInstanceOf(Error);
    expect(readFileSync(dest, 'utf8')).toBe('old');
    expect(leftovers()).toEqual([]);
  });

  describe('zero padding after the gzip data that continues in a later read', () => {
    const first = Buffer.concat([GZ, Buffer.alloc(1)]);
    const rest = Buffer.alloc(8);

    it.each([
      ['with', { 'Content-Length': String(first.length + rest.length) }],
      ['without', {}],
    ])('is ignored %s a Content-Length', async (_name, headers) => {
      // The padding goes on over two later reads.
      const s = await startStub((_req, res) => {
        res.writeHead(200, headers);
        const later = () => res.write(rest.subarray(0, 4), () => setTimeout(() => res.end(rest.subarray(4)), 50));
        res.write(first, () => setTimeout(later, 50));
      });
      const dest = join(dir, 'export.csv');
      await stubClient(s).downloadAndDecompressExport(`${s.url}${PATH}`, dest);
      expect(readFileSync(dest, 'utf8')).toBe(CSV);
    });

    it('ends when the last read leaves 16 KiB unread as the gzip data ends', { timeout: 3000 }, async () => {
      // Node 18 then never calls back the write of that read into the gunzip.
      nock.restore();
      onTestFinished(() => nock.activate());
      const { text, parts } = paddedGzipInThreeParts();
      let wroteFirst!: () => void;
      const firstWritten = new Promise<void>((resolve) => (wroteFirst = resolve));
      let sentLast!: () => void;
      const lastSent = new Promise<void>((resolve) => (sentLast = resolve));
      const s = await startStub((_req, res) => {
        res.writeHead(200, { 'Content-Length': String(Buffer.concat(parts).length) });
        res.write(parts[0]);
        void firstWritten.then(() => res.write(parts[1], () => setTimeout(() => res.end(parts[2], sentLast), 50)));
      });
      const chunks: Buffer[] = [];
      // The destination holds the first chunk until the last read has been decompressed.
      const dest = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk);
          if (chunks.length > 1) return callback();
          wroteFirst();
          void lastSent.then(() => setTimeout(callback, 50));
        },
      });
      await stubClient(s).downloadAndDecompressExport(`${s.url}${PATH}`, dest);
      expect(Buffer.concat(chunks).toString()).toBe(text);
    });

    it('still fails a body shorter than its Content-Length', async () => {
      raw = await RawServer.start((socket) =>
        socket.once('data', () => {
          socket.write(`HTTP/1.1 200 OK\r\nContent-Length: ${first.length + rest.length + 10}\r\n\r\n`);
          socket.write(first, () => setTimeout(() => socket.end(rest), 50));
        }),
      );
      const client = stubClient({ url: raw.url }, { tokenStore: seededTokenStore() });
      const error = await failure(client.downloadAndDecompressExport(`${raw.url}${PATH}`));
      expect(error).toBeInstanceOf(DidwwClientError);
      expect(error.message).toBe('Export data is incomplete');
    });
  });

  it('fails for an empty export', async () => {
    const s = await startStub(fileReply(Buffer.alloc(0)));
    const error = await failure(stubClient(s).downloadAndDecompressExport(`${s.url}${PATH}`));
    expect(error.message).toBe('Failed to decompress export data: the export is empty');
  });

  it('reports a cut body as incomplete', async () => {
    raw = await cutServer('HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\n', GZ);
    const client = stubClient({ url: raw.url }, { tokenStore: seededTokenStore() });
    const error = await failure(client.downloadAndDecompressExport(`${raw.url}${PATH}`));
    expect(error.message).toBe('Export data is incomplete');
  });
});
