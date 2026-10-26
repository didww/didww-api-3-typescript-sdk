import { describe, it, expect, vi } from 'vitest';
import { inspect, isDeepStrictEqual } from 'node:util';
import { cloneJson, JsonNumber, normalizeNumbers, parseJson, stringifyJson } from '../src/json.js';
import { DidwwClientError } from '../src/errors.js';
import { deserialize, serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { defineResource } from '../src/resources/base.js';
import type * as Registry from '../src/registry.js';

const WIRE = defineResource<Record<string, unknown>, Record<string, unknown>>()({
  type: 'json_test_wires',
  path: 'json_test_wires',
  writableKeys: ['configuration', 'name', 'limits'],
  wireAttributes: ['configuration'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});

vi.mock('../src/registry.js', async (importOriginal) => {
  const original = await importOriginal<typeof Registry>();
  return {
    ...original,
    getResourceConfig: (type: string) => (type === WIRE.type ? WIRE : original.getResourceConfig(type)),
  };
});

describe('parseJson', () => {
  it.each([
    ['1.1', 1.1],
    ['0.1', 0.1],
    ['42', 42],
    ['-7', -7],
    ['9007199254740992', 9007199254740992],
    ['0', 0],
  ])('keeps the canonical number %s as a number', (text, expected) => {
    expect(parseJson(text)).toBe(expected);
  });

  it.each(['1.10', '9007199254740993', '123456789012345678901234567890', '1e2', '-0', '1.0', '1E+2', '1e999'])(
    'keeps %s exactly as a JsonNumber',
    (text) => {
      const value = parseJson(text);
      expect(value).toBeInstanceOf(JsonNumber);
      expect((value as JsonNumber).text).toBe(text);
    },
  );

  it('parses the same values as JSON.parse for canonical input', () => {
    const text = JSON.stringify({
      a: [1, 2.5, -3, true, false, null, 'xé ', { b: 'esc\\"aped\n' }],
      c: {},
      d: [],
      e: 'sur😀',
    });
    expect(parseJson(text)).toEqual(JSON.parse(text));
  });

  it('accepts a Buffer and surrounding whitespace', () => {
    expect(parseJson(Buffer.from(' \n{"a" : [ 1 , 2 ] }\t'))).toEqual({ a: [1, 2] });
  });

  it('defines __proto__ as an own property without changing the prototype', () => {
    const value = parseJson('{"__proto__": {"polluted": 1}, "a": 1}') as Record<string, unknown>;
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.keys(value)).toEqual(['__proto__', 'a']);
    expect((value as { polluted?: number }).polluted).toBeUndefined();
  });

  it.each([
    '',
    '{',
    '[1,]',
    '{"a":1,}',
    '01',
    '1.',
    '.5',
    '+1',
    'NaN',
    'Infinity',
    "'x'",
    '"\u0001"',
    '"\\x"',
    '"\\u12"',
    '"unterminated',
    'tru',
    '{"a" 1}',
    '[1] [2]',
    '"a\\',
  ])('rejects the invalid document %j with a SyntaxError', (text) => {
    expect(() => parseJson(text)).toThrow(SyntaxError);
  });

  it('rejects nesting deeper than 512 levels with a SyntaxError', () => {
    expect(parseJson('['.repeat(512) + ']'.repeat(512))).toBeDefined();
    expect(() => parseJson('['.repeat(513) + ']'.repeat(513))).toThrow(SyntaxError);
    expect(() => parseJson('['.repeat(100_000))).toThrow(SyntaxError);
  });
});

describe('stringifyJson', () => {
  it('writes JsonNumber and bigint values exactly', () => {
    const doc = {
      ratio: new JsonNumber('1.10'),
      sequence: new JsonNumber('9007199254740993'),
      ids: [123456789012345678901234567890n],
      plain: 1.5,
      cleared: null,
    };
    expect(stringifyJson(doc)).toBe(
      '{"ratio":1.10,"sequence":9007199254740993,"ids":[123456789012345678901234567890],"plain":1.5,"cleared":null}',
    );
  });

  it('writes a top-level JsonNumber', () => {
    expect(stringifyJson(new JsonNumber('1e2'))).toBe('1e2');
  });

  it('keeps native semantics for everything else', () => {
    const date = new Date('2026-10-22T00:00:00.000Z');
    expect(stringifyJson({ a: undefined, d: date, s: '\u0000' })).toBe(JSON.stringify({ d: date, s: '\u0000' }));
  });

  it('cannot be fooled by a string that looks like its placeholder', () => {
    const doc = { n: new JsonNumber('1.10'), s: '\u0000abc:0\u0000' };
    expect(JSON.parse(stringifyJson(doc)).s).toBe('\u0000abc:0\u0000');
  });

  it.each([NaN, Infinity, -Infinity])('rejects %s', (n) => {
    expect(() => stringifyJson({ n })).toThrow(DidwwClientError);
  });

  it('round-trips the exact text of every number', () => {
    const text = '{"a":[1.10,9007199254740993,1e2,-0,0.1,7]}';
    expect(stringifyJson(parseJson(text))).toBe(text);
  });
});

describe('JsonNumber', () => {
  it('validates its text', () => {
    expect(() => new JsonNumber('1.')).toThrow(TypeError);
    expect(() => new JsonNumber(' 1')).toThrow(TypeError);
    expect(() => new JsonNumber('0x10')).toThrow(TypeError);
    expect(JsonNumber.from(12345678901234567890n).text).toBe('12345678901234567890');
    expect(JsonNumber.from(1.5).text).toBe('1.5');
    expect(() => JsonNumber.from(NaN)).toThrow(TypeError);
  });

  it('is immutable and converts to number and string', () => {
    const n = new JsonNumber('1.10');
    expect(Object.isFrozen(n)).toBe(true);
    expect(Number(n)).toBe(1.1);
    expect(String(n)).toBe('1.10');
    expect(JSON.stringify({ n })).toBe('{"n":"1.10"}');
    expect(inspect(n)).toBe('JsonNumber(1.10)');
  });

  it('compares by text with isDeepStrictEqual', () => {
    expect(isDeepStrictEqual(new JsonNumber('1.10'), new JsonNumber('1.10'))).toBe(true);
    expect(isDeepStrictEqual(new JsonNumber('1.10'), new JsonNumber('1.1'))).toBe(false);
  });

  it('recognises a JsonNumber of another copy of the SDK, but no other object', () => {
    const brand = Symbol.for('@didww/sdk.JsonNumber');
    const branded = (text: PropertyDescriptor) =>
      Object.defineProperties({}, { text: { enumerable: true, ...text }, [brand]: { value: true } });
    // As the constructor of another copy builds it.
    const other = Object.freeze(branded({ value: '1.10', writable: true, configurable: true }));
    expect(other).toBeInstanceOf(JsonNumber);
    expect(stringifyJson({ a: other })).toBe('{"a":1.10}');

    const forged = [
      Object.freeze({ text: '1.10' }),
      Object.freeze(branded({ value: '1,"admin":true', writable: true, configurable: true })),
      branded({ value: '1.10', writable: true, configurable: true }),
      branded({ get: () => '1.10' }),
    ];
    for (const value of forged) {
      expect(value).not.toBeInstanceOf(JsonNumber);
      expect(stringifyJson({ a: value })).toBe(JSON.stringify({ a: value }));
    }
  });
});

describe('cloneJson and normalizeNumbers', () => {
  it('copies arrays and plain objects deeply and keeps JsonNumber', () => {
    const n = new JsonNumber('1.10');
    const value = { a: [{ b: n }], d: new Date(0) };
    const copy = cloneJson(value);
    expect(copy).not.toBe(value);
    expect(copy.a[0]).not.toBe(value.a[0]);
    expect(copy.a[0].b).toBe(n);
    expect(copy.d).not.toBe(value.d);
    expect(isDeepStrictEqual(copy, value)).toBe(true);
  });

  it('turns every JsonNumber into a number', () => {
    expect(normalizeNumbers({ a: [new JsonNumber('1.10'), { b: new JsonNumber('1e2') }], c: 'x' })).toEqual({
      a: [1.1, { b: 100 }],
      c: 'x',
    });
  });
});

describe('serializer and exact numbers', () => {
  const body = parseJson(
    '{"data":{"id":"w1","type":"json_test_wires","attributes":{"name":"n","limits":{"max_rate":1.10},' +
      '"configuration":{"type":"generic","attributes":{"X-Source":"a","ratio":1.10,"sequence":9007199254740993,' +
      '"ids":[123456789012345678901234567890],"cleared":null}}},"meta":{"total_count":1e2}}}',
  );

  it('keeps wire attributes exactly and normalizes everything else', () => {
    const { data } = deserialize<Record<string, unknown>>(body) as { data: Record<string, unknown> };
    const configuration = data.configuration as { attributes: Record<string, unknown> };
    expect(Object.keys(configuration.attributes)).toEqual(['X-Source', 'ratio', 'sequence', 'ids', 'cleared']);
    expect(configuration.attributes.ratio).toBeInstanceOf(JsonNumber);
    expect(data.limits).toEqual({ maxRate: 1.1 });
    expect((data.meta as Record<string, unknown>).totalCount).toBe(100);
  });

  it('sends a loaded wire attribute back byte-exact and only when changed', () => {
    const { data } = deserialize<Record<string, unknown>>(parseJson(stringifyJson(body))) as {
      data: Record<string, unknown> & { id: string };
    };
    expect(serializeForUpdate(WIRE, data).data.attributes ?? {}).toEqual({});

    (data.configuration as { attributes: Record<string, unknown> }).attributes.endpoint = 'https://example.com/v2';
    const sent = stringifyJson(serializeForUpdate(WIRE, data));
    expect(sent).toContain('"X-Source":"a"');
    expect(sent).toContain('"ratio":1.10');
    expect(sent).toContain('"sequence":9007199254740993');
    expect(sent).toContain('[123456789012345678901234567890]');
    expect(sent).toContain('"cleared":null');
    expect(sent).not.toContain('"name"');
  });

  it('does not rename keys inside wire attributes on create', () => {
    const sent = serializeForCreate(WIRE, {
      name: 'n',
      configuration: { type: 'generic', attributes: { 'X-Source': 'a', HTTPHeader: 'b' } },
    });
    expect(sent.data.attributes?.configuration).toEqual({
      type: 'generic',
      attributes: { 'X-Source': 'a', HTTPHeader: 'b' },
    });
  });

  it('passes class instances through the key transform', () => {
    const sent = serializeForCreate(WIRE, { name: 'n', limits: { maxRate: new JsonNumber('1.10') } });
    expect(stringifyJson(sent)).toContain('"limits":{"max_rate":1.10}');
  });
});
