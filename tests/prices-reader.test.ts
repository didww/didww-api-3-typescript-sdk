import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createReadStream, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { DidwwClientError } from '../src/errors.js';
import { CsvParser, MAX_FIELD_LENGTH, MAX_FIELDS, MAX_RECORD_LENGTH, type CsvRecord } from '../src/prices/csv.js';
import { PriceFileReader, readPriceFile, type PriceFileRow } from '../src/prices/price-file-reader.js';
import { paddedGzipInThreeParts } from './helpers/gzip.js';
import { failure, pricesFixture } from './helpers/prices.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'didww-price-file-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function collect(source: Parameters<typeof readPriceFile>[0]): Promise<PriceFileRow[]> {
  const rows: PriceFileRow[] = [];
  for await (const row of readPriceFile(source)) rows.push(row);
  return rows;
}

const csv = (text: string) => gzipSync(Buffer.from(text, 'utf8'));

// Reads the first row { a: '1' } of `source`, then breaks on 'break' or meets
// the format error that follows it on 'a format error'; with `pause`, after
// waiting a moment.
async function leaveEarly(mode: string, source: Parameters<typeof readPriceFile>[0], pause = false): Promise<void> {
  const error = await (async () => {
    for await (const row of readPriceFile(source)) {
      expect(row).toEqual({ a: '1' });
      if (pause) await new Promise((resolve) => setTimeout(resolve, 20));
      if (mode === 'break') break;
    }
  })().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error === null).toBe(mode === 'break');
  if (error !== null) expect(error).toBeInstanceOf(DidwwClientError);
}

// A web ReadableStream that sends `data` without its last 8 bytes and then
// waits for data that never comes.
function stalledWebStream(data: Buffer, state: { cancelled: boolean }): ReadableStream<Uint8Array> {
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull: (controller) => {
      if (sent) return new Promise<void>(() => undefined);
      sent = true;
      controller.enqueue(data.subarray(0, data.length - 8));
    },
    cancel: () => {
      state.cancelled = true;
    },
  });
}

async function* bytesOneByOne(data: Buffer): AsyncGenerator<Uint8Array> {
  for (const byte of data) yield Uint8Array.of(byte);
}

describe('readPriceFile', () => {
  it('reads the Voice IN price file', async () => {
    const path = join(dir, 'voice_in_prices.csv.gz');
    writeFileSync(path, pricesFixture('voice_in_prices.csv.gz'));
    const rows = await collect(path);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      Country: 'United Kingdom',
      'Src country name': '',
      'Source type': 'cellular',
      Destination: '44800',
      'Rate (USD, excl. VAT)': '',
      'Connection fee (USD, excl. VAT)': '',
      'Initial interval': '60',
      'Next interval': '60',
      'Reject calls': 'true',
    });
    expect(rows[2]['Rate (USD, excl. VAT)']).toBe('0.025');
    expect(Object.isFrozen(rows[0])).toBe(true);
  });

  it('reads the Voice OUT price file', async () => {
    const rows = await collect(pricesFixture('voice_out_prices.csv.gz'));
    expect(rows).toHaveLength(4);
    expect(rows[0]['Effective date']).toBe('2026-11-01T00:00:00Z');
    expect(rows[2].Prefix).toBe('99950,99951,99952');
    expect(rows[3]['Reject calls']).toBe('true');
  });

  it('reads a stream and an async iterable', async () => {
    const gz = pricesFixture('voice_in_prices.csv.gz');
    expect(await collect(Readable.from([gz]))).toHaveLength(4);
    expect(await collect(bytesOneByOne(gz))).toHaveLength(4);
  });

  it('skips a byte order mark, also split across chunks', async () => {
    const gz = csv('﻿a,b\n1,2\n');
    expect(await collect(gz)).toEqual([{ a: '1', b: '2' }]);
    expect(await collect(bytesOneByOne(gz))).toEqual([{ a: '1', b: '2' }]);
  });

  it('keeps a second byte order mark and reads invalid UTF-8 as U+FFFD', async () => {
    const data = Buffer.concat([Buffer.from('﻿a\n﻿x'), Buffer.from([0xff]), Buffer.from('\n')]);
    expect(await collect(gzipSync(data))).toEqual([{ a: '﻿x�' }]);
  });

  it('makes a __proto__ column a plain key', async () => {
    const [row] = await collect(csv('__proto__,constructor\nx,y\n'));
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(row, '__proto__')).toBe(true);
    expect(row['__proto__']).toBe('x');
    expect(row.constructor).toBe('y');
  });

  it('keeps the last of duplicate column names', async () => {
    expect(await collect(csv('a,a\n1,2\n'))).toEqual([{ a: '2' }]);
  });

  it.each([
    [
      'CRLF line ends',
      'a,b\r\n1,2\r\n3,4',
      [
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ],
    ],
    ['lone CR line ends', 'a,b\r1,2\r', [{ a: '1', b: '2' }]],
    ['line breaks inside quotes kept as they are', 'a,b\n"x\r\ny","p\nq"\n', [{ a: 'x\r\ny', b: 'p\nq' }]],
    ['escaped quotes', 'a,b\n"say ""hi""",""\n', [{ a: 'say "hi"', b: '' }]],
    ['empty lines skipped', '\na,b\n\n\r\n1,2\n\n', [{ a: '1', b: '2' }]],
    ['empty fields', 'a,b,c\n,,\n', [{ a: '', b: '', c: '' }]],
    ['a quoted comma', 'a,b\n"1,5",2\n', [{ a: '1,5', b: '2' }]],
    ['a header only', 'a,b\n', []],
    ['an empty file', '', []],
  ])('reads %s', async (_name, text, rows) => {
    expect(await collect(csv(text))).toEqual(rows);
  });

  it.each([
    ['a row with fewer fields', 'a,b\n1,2\n3\n', 'price file record on line 3: wrong number of fields'],
    ['a row with more fields', 'a,b\n"x\ny",2,3\n', 'price file record on line 2: wrong number of fields'],
    ['text after a closing quote', 'a,b\n"1"x,2\n', 'price file record on line 2: text after a closing quote'],
    [
      'a quote inside an unquoted field',
      'a,b\n1"2,3\n',
      'price file record on line 2: a quote inside an unquoted field',
    ],
    ['an unterminated quote', 'a,b\n"1,2\n', 'price file record on line 2: a quoted field is not terminated'],
    ['a long run of commas', `a,b\n${','.repeat(50_000_000)}\n`, 'price file record on line 2: too many fields'],
  ])('refuses %s', async (_name, text, message) => {
    const error = await failure(collect(csv(text)));
    expect(error).toBeInstanceOf(DidwwClientError);
    expect(error.message).toBe(message);
  });

  it('yields the rows before a damaged record', async () => {
    const rows: PriceFileRow[] = [];
    await expect(
      (async () => {
        for await (const row of readPriceFile(csv('a\n1\n2\n"x"y\n'))) rows.push(row);
      })(),
    ).rejects.toBeInstanceOf(DidwwClientError);
    expect(rows).toEqual([{ a: '1' }, { a: '2' }]);
  });

  it('reads several gzip members and ignores what follows a zero byte', async () => {
    const members = Buffer.concat([csv('a,b\n1,2\n'), csv('3,4\n')]);
    expect(await collect(members)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
    expect(await collect(Buffer.concat([csv('a\n1\n'), Buffer.alloc(16)]))).toEqual([{ a: '1' }]);
    expect(await collect(Buffer.concat([csv('a\n1\n'), Buffer.from('\0junk')]))).toEqual([{ a: '1' }]);
    expect(await collect(Buffer.concat([csv('a\n1\n'), Buffer.alloc(5), csv('2\n')]))).toEqual([{ a: '1' }]);
  });

  it('ignores what follows a zero byte also when it comes in later reads', async () => {
    const member = csv('a\n1\n');
    const padded = Buffer.concat([member, Buffer.alloc(1)]);
    expect(await collect(Readable.from([padded, Buffer.alloc(2)]))).toEqual([{ a: '1' }]);
    expect(await collect(Readable.from([padded, Buffer.from('junk')]))).toEqual([{ a: '1' }]);
    expect(await collect(Readable.from([padded, csv('2\n')]))).toEqual([{ a: '1' }]);
    const path = join(dir, 'padded.csv.gz');
    writeFileSync(path, Buffer.concat([member, Buffer.alloc(200 * 1024)]));
    expect(await collect(path)).toEqual([{ a: '1' }]);
    const error = await failure(collect(Readable.from([member, Buffer.from('junk')])));
    expect((error as NodeJS.ErrnoException).code).toBe('Z_DATA_ERROR');
  });

  it.each([
    ['a later member', csv('9,9\n')],
    ['data that is not gzip', Buffer.from('junk')],
  ])(
    'reads a large member in full when %s after a zero byte comes in a later read, also for a slow consumer',
    async (_name, after) => {
      const count = 20_000;
      const lines = Array.from({ length: count }, (_, i) => `${i},${'x'.repeat(20)}\n`);
      const member = Buffer.concat([csv(`a,b\n${lines.join('')}`), Buffer.alloc(1)]);
      let read = 0;
      for await (const row of readPriceFile(Readable.from([member, after]))) {
        expect(row.a).toBe(String(read));
        read++;
        if (read % 100 === 0) await new Promise((r) => setTimeout(r, 1));
      }
      expect(read).toBe(count);
    },
  );

  it.each([
    ['data that is not gzip', Buffer.from('a,b\n1,2\n'), 'Z_DATA_ERROR'],
    ['gzip data cut short', pricesFixture('voice_in_prices.csv.gz').subarray(0, 40), 'Z_BUF_ERROR'],
    ['a later member cut short', Buffer.concat([csv('a\n1\n'), csv('2\n').subarray(0, 12)]), 'Z_BUF_ERROR'],
    ['an empty input', Buffer.alloc(0), 'Z_BUF_ERROR'],
    ['data after the gzip data', Buffer.concat([csv('a\n1\n'), Buffer.from('junk')]), 'Z_DATA_ERROR'],
    ['two bytes after the gzip data', Buffer.concat([csv('a\n1\n'), Buffer.from('XY')]), 'Z_DATA_ERROR'],
    ['a single byte after the gzip data', Buffer.concat([csv('a\n1\n'), Buffer.from('\n')]), 'Z_BUF_ERROR'],
  ])('fails for %s', async (_name, data, code) => {
    const error = await failure(collect(data));
    expect((error as NodeJS.ErrnoException).code).toBe(code);
  });

  it('fails for a bad checksum', async () => {
    const gz = Buffer.from(csv('a\n1\n'));
    gz[gz.length - 5] ^= 0xff;
    const error = await failure(collect(gz));
    expect((error as NodeJS.ErrnoException).code).toBe('Z_DATA_ERROR');
  });

  it('opens a path lazily', async () => {
    const rows = readPriceFile(join(dir, 'missing.csv.gz'));
    const error = await failure(rows.next());
    expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
  });

  it('refuses a source that cannot be read', () => {
    for (const source of [42, null, undefined, {}, new URL('file:///x')]) {
      expect(() => readPriceFile(source as never)).toThrow(DidwwClientError);
      expect(() => new PriceFileReader(source as never)).toThrow(DidwwClientError);
    }
  });

  it('destroys a stream source on break', async () => {
    const path = join(dir, 'voice_in_prices.csv.gz');
    writeFileSync(path, pricesFixture('voice_in_prices.csv.gz'));
    const stream = createReadStream(path);
    const closed = new Promise<void>((resolve) => stream.once('close', () => resolve()));
    for await (const row of readPriceFile(stream)) {
      expect(row.Country).toBe('United Kingdom');
      break;
    }
    await closed;
    expect(stream.destroyed).toBe(true);
  });

  it.each(['break', 'a format error'])('destroys a stream source that waits for data on %s', async (mode) => {
    const gz = mode === 'break' ? csv('a\n1\n2\n') : csv('a\n1\n2,3\n');
    const source = new PassThrough();
    source.write(gz.subarray(0, gz.length - 8));
    const closed = new Promise<void>((resolve) => source.once('close', () => resolve()));
    await leaveEarly(mode, source);
    await closed;
    expect(source.destroyed).toBe(true);
  });

  it.each(['break', 'a format error'])('returns an async iterable source that waits for data on %s', async (mode) => {
    const gz = mode === 'break' ? csv('a\n1\n2\n') : csv('a\n1\n2,3\n');
    let returned!: () => void;
    const released = new Promise<void>((resolve) => (returned = resolve));
    let pulled = 0;
    // Its return() also ends a pull that is waiting, as the iterator of events.on does.
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          if (pulled++ === 0) return { value: gz.subarray(0, gz.length - 8), done: false };
          await released;
          return { value: undefined, done: true };
        },
        return: async () => {
          returned();
          return { value: undefined, done: true };
        },
      }),
    };
    await leaveEarly(mode, source);
    await released;
    expect(pulled).toBe(2);
  });

  it.each(['break', 'a format error'])('cancels a web ReadableStream that waits for data on %s', async (mode) => {
    const state = { cancelled: false };
    await leaveEarly(mode, stalledWebStream(mode === 'break' ? csv('a\n1\n2\n') : csv('a\n1\n2,3\n'), state));
    await vi.waitFor(() => expect(state.cancelled).toBe(true));
  });

  it('reads a web ReadableStream', async () => {
    const gz = pricesFixture('voice_in_prices.csv.gz');
    expect(await collect(new Blob([gz]).stream())).toHaveLength(4);
  });

  describe('an endless async iterable source', () => {
    // The header and a row, then one more row per gzip member; with 'a format error'
    // the first member ends with a row of two fields.
    const member = (mode: string, n: number) =>
      n === 1 ? csv(mode === 'break' ? 'a\n1\n' : 'a\n1\n2,3\n') : csv(`${n}\n`);
    // The first pulls are immediate, so that a write is still going on when the
    // iteration ends; later ones wait for the event loop, so that reading the
    // source on does not starve the timers.
    const tick = (state: State) => (state.pulled < 3 ? undefined : new Promise((resolve) => setImmediate(resolve)));
    // released: null for a source that cannot be released.
    type State = { pulled: number; released: boolean | null };
    const sources: Array<[string, (mode: string, state: State) => AsyncIterable<Uint8Array>]> = [
      [
        'an async generator',
        (mode, state) =>
          (async function* () {
            try {
              for (;;) {
                await tick(state);
                yield member(mode, ++state.pulled);
              }
            } finally {
              state.released = true;
            }
          })(),
      ],
      [
        'a web ReadableStream',
        (mode, state) =>
          new ReadableStream<Uint8Array>({
            pull: async (controller) => {
              await tick(state);
              controller.enqueue(member(mode, ++state.pulled));
            },
            cancel: () => {
              state.released = true;
            },
          }) as unknown as AsyncIterable<Uint8Array>,
      ],
      [
        'an async iterator without return',
        (mode, state) => {
          state.released = null;
          return {
            [Symbol.asyncIterator]: () => ({
              next: async () => {
                await tick(state);
                return { value: member(mode, ++state.pulled), done: false };
              },
            }),
          };
        },
      ],
    ];

    describe.each(sources)('%s', (_name, make) => {
      it.each(['break', 'a format error'])('is released and no longer read on %s', async (mode) => {
        const state: State = { pulled: 0, released: false };
        await leaveEarly(mode, make(mode, state));
        await vi.waitFor(() => expect(state.released).not.toBe(false));
        await new Promise((resolve) => setTimeout(resolve, 20));
        const pulled = state.pulled;
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(state.pulled).toBe(pulled);
        expect(pulled).toBeLessThan(10);
      });
    });
  });

  // zlib ends the output at the padding, while the rows of the last chunk are still being read.
  describe('a gzip member followed by zero padding', () => {
    // The header and a row, then a row of two fields on 'a format error', and the padding.
    const padded = (mode: string) =>
      Buffer.concat([csv(mode === 'break' ? 'a\n1\n2\n' : 'a\n1\n2,3\n'), Buffer.alloc(4)]);

    it.each(['break', 'a format error'])('destroys a stream source that waits for data on %s', async (mode) => {
      const source = new PassThrough();
      source.write(padded(mode));
      const closed = new Promise<void>((resolve) => source.once('close', () => resolve()));
      await leaveEarly(mode, source, true);
      await closed;
      expect(source.destroyed).toBe(true);
    });

    it.each(['break', 'a format error'])('cancels a web ReadableStream that waits for data on %s', async (mode) => {
      const state = { cancelled: false };
      let sent = false;
      const source = new ReadableStream<Uint8Array>({
        pull: (controller) => {
          if (sent) return new Promise<void>(() => undefined);
          sent = true;
          controller.enqueue(padded(mode));
        },
        cancel: () => {
          state.cancelled = true;
        },
      });
      await leaveEarly(mode, source, true);
      await vi.waitFor(() => expect(state.cancelled).toBe(true));
    });

    it.each(['break', 'a format error'])('returns an endless async generator on %s', async (mode) => {
      const state = { pulled: 0, released: false };
      const source = (async function* () {
        try {
          yield padded(mode);
          for (;;) {
            await new Promise((resolve) => setImmediate(resolve));
            state.pulled++;
            yield Buffer.alloc(4);
          }
        } finally {
          state.released = true;
        }
      })();
      await leaveEarly(mode, source, true);
      await vi.waitFor(() => expect(state.released).toBe(true));
      const pulled = state.pulled;
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(state.pulled).toBe(pulled);
    });
  });
});

describe('PriceFileReader', () => {
  it('ends when the last write leaves 16 KiB unread as the gzip data ends', { timeout: 3000 }, async () => {
    // Node 18 then never calls back that write into the gunzip.
    const { text, parts } = paddedGzipInThreeParts();
    let readFirst!: () => void;
    const firstRead = new Promise<void>((resolve) => (readFirst = resolve));
    let pullLast!: () => void;
    const lastPulled = new Promise<void>((resolve) => (pullLast = resolve));
    async function* source(): AsyncGenerator<Uint8Array> {
      yield parts[0];
      await firstRead;
      yield parts[1];
      pullLast();
      yield parts[2];
    }
    const values: string[] = [];
    // The rows are not read on until the last part has been decompressed.
    for await (const row of new PriceFileReader(source())) {
      if (values.length === 0) {
        readFirst();
        await lastPulled;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      values.push(row.a);
    }
    expect(['a', ...values, ''].join('\n')).toBe(text);
  });

  it('iterates the rows of a path', async () => {
    const path = join(dir, 'voice_out_prices.csv.gz');
    writeFileSync(path, pricesFixture('voice_out_prices.csv.gz'));
    const reader = new PriceFileReader(path);
    const categories: string[] = [];
    for await (const row of reader) categories.push(row.Category);
    expect(categories).toEqual(['International', 'Origin based', 'International', 'International']);
  });

  it('does not open a missing path until iterated', async () => {
    const reader = new PriceFileReader(join(dir, 'missing.csv.gz'));
    const error = await failure(reader[Symbol.asyncIterator]().next());
    expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
  });

  it('ends an iteration on close and closes the source', async () => {
    const stream = Readable.from([pricesFixture('voice_in_prices.csv.gz')]);
    const reader = new PriceFileReader(stream);
    const iterator = reader[Symbol.asyncIterator]();
    expect((await iterator.next()).done).toBe(false);
    await reader.close();
    expect((await iterator.next()).done).toBe(true);
    expect(stream.destroyed).toBe(true);
    expect((await reader[Symbol.asyncIterator]().next()).done).toBe(true);
  });

  it('ends an iteration waiting for data on close and destroys the source', async () => {
    const gz = csv('a\n1\n2\n');
    const source = new PassThrough();
    source.write(gz.subarray(0, gz.length - 8));
    const reader = new PriceFileReader(source);
    const rows: PriceFileRow[] = [];
    const loop = (async () => {
      for await (const row of reader) rows.push(row);
    })();
    await vi.waitFor(() => expect(rows).toHaveLength(2));
    expect(rows).toEqual([{ a: '1' }, { a: '2' }]);
    await reader.close();
    await loop;
    expect(source.destroyed).toBe(true);
  });

  it('ends an iteration waiting for data on close and cancels a web ReadableStream', async () => {
    const state = { cancelled: false };
    const reader = new PriceFileReader(stalledWebStream(csv('a\n1\n2\n'), state));
    const rows: PriceFileRow[] = [];
    const loop = (async () => {
      for await (const row of reader) rows.push(row);
    })();
    await vi.waitFor(() => expect(rows).toHaveLength(2));
    await reader.close();
    await loop;
    await vi.waitFor(() => expect(state.cancelled).toBe(true));
  });

  it('cancels a web ReadableStream on close before any iteration', async () => {
    const state = { cancelled: false };
    const stream = stalledWebStream(csv('a\n1\n'), state);
    await new PriceFileReader(stream).close();
    await vi.waitFor(() => expect(state.cancelled).toBe(true));
    // A stream locked by another reader is left to it.
    const other = { cancelled: false };
    const locked = stalledWebStream(csv('a\n1\n'), other);
    const lock = locked.getReader();
    await new PriceFileReader(locked).close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(other.cancelled).toBe(false);
    lock.releaseLock();
  });

  it('destroys a stream source on close before any iteration', async () => {
    const unread = new PassThrough();
    await new PriceFileReader(unread).close();
    expect(unread.destroyed).toBe(true);
    const unstarted = new PassThrough();
    const reader = new PriceFileReader(unstarted);
    reader[Symbol.asyncIterator]();
    await reader.close();
    expect(unstarted.destroyed).toBe(true);
  });

  it('yields nothing once closed', async () => {
    const reader = new PriceFileReader(join(dir, 'missing.csv.gz'));
    await reader.close();
    const rows: PriceFileRow[] = [];
    for await (const row of reader) rows.push(row);
    expect(rows).toEqual([]);
  });
});

describe('CsvParser', () => {
  const parse = (pieces: string[]): string[][] => {
    const parser = new CsvParser();
    const out: CsvRecord[] = [];
    for (const piece of pieces) parser.push(piece, out);
    parser.end(out);
    return out.map((r) => r.fields);
  };

  it('gives the same records however the text is split', () => {
    const text = 'a,"b ""q"""\r\n"x\r\ny",\r\n\r\n1,2\r3,"4"\n"",x';
    const whole = parse([text]);
    expect(whole).toEqual([
      ['a', 'b "q"'],
      ['x\r\ny', ''],
      ['1', '2'],
      ['3', '4'],
      ['', 'x'],
    ]);
    expect(parse(text.split(''))).toEqual(whole);
    for (let i = 1; i < text.length; i++) expect(parse([text.slice(0, i), text.slice(i)])).toEqual(whole);
  });

  it('counts lines inside quoted fields', () => {
    const parser = new CsvParser();
    const out: CsvRecord[] = [];
    parser.push('"a\nb",c\nd,e\n', out);
    expect(out.map((r) => r.line)).toEqual([1, 3]);
  });

  it('refuses a field that is too long', () => {
    const parser = new CsvParser();
    expect(() => parser.push(`"${'x'.repeat(MAX_FIELD_LENGTH + 1)}"`, [])).toThrow(
      'price file record on line 1: a field is too long',
    );
  });

  it('refuses a record with too many fields', () => {
    const out: CsvRecord[] = [];
    new CsvParser().push(`${','.repeat(MAX_FIELDS - 1)}\n`, out);
    expect(out[0].fields).toHaveLength(MAX_FIELDS);
    expect(() => new CsvParser().push(`a\n${','.repeat(MAX_FIELDS)}`, [])).toThrow(
      'price file record on line 2: too many fields',
    );
  });

  it('refuses a record that is too long', () => {
    const field = 'x'.repeat(MAX_FIELD_LENGTH);
    const fields = Math.floor(MAX_RECORD_LENGTH / MAX_FIELD_LENGTH);
    const out: CsvRecord[] = [];
    new CsvParser().push(`${Array(fields).fill(field).join(',')}\n`, out);
    expect(out).toHaveLength(1);
    expect(() =>
      new CsvParser().push(
        `${Array(fields + 1)
          .fill(field)
          .join(',')}\n`,
        [],
      ),
    ).toThrow('price file record on line 1: the record is too long');
  });
});
