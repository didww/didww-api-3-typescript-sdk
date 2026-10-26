import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { DidwwClientError } from './errors.js';

const NUMBER_RE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;

// Marks a JsonNumber of any copy of the SDK (an ESM and a CJS build loaded together).
const JSON_NUMBER_BRAND = Symbol.for('@didww/sdk.JsonNumber');

/**
 * A JSON number kept as its exact text.
 *
 * Responses are parsed without losing digits: a number becomes a plain
 * `number` when that number prints back as the same text (`1.1`, `42`), and a
 * `JsonNumber` otherwise (`1.10`, `9007199254740993`, `1e2`, `-0`). Resources
 * turn every `JsonNumber` into a `number`, except inside values the API
 * defines as free-form, such as the attributes of a generic SMS trunk
 * configuration, where the exact text is kept and sent back unchanged.
 *
 * Request bodies write a `JsonNumber` (and a `bigint`) as an exact JSON number,
 * also one built by another copy of the SDK (an ESM and a CJS build loaded
 * together), which `instanceof JsonNumber` therefore recognises.
 */
export class JsonNumber {
  readonly text: string;

  constructor(text: string) {
    if (typeof text !== 'string' || !NUMBER_RE.test(text)) {
      throw new TypeError('JsonNumber text must be a JSON number');
    }
    this.text = text;
    Object.defineProperty(this, JSON_NUMBER_BRAND, { value: true });
    Object.freeze(this);
  }

  // A JsonNumber of any copy: branded, with a fixed `text` that is a JSON number,
  // so that no other object can put raw JSON into a request body.
  static [Symbol.hasInstance](value: unknown): value is JsonNumber {
    if (value === null || typeof value !== 'object') return false;
    if ((value as { [JSON_NUMBER_BRAND]?: unknown })[JSON_NUMBER_BRAND] !== true) return false;
    const text = Object.getOwnPropertyDescriptor(value, 'text');
    return (
      text !== undefined &&
      text.writable === false &&
      text.configurable === false &&
      typeof text.value === 'string' &&
      NUMBER_RE.test(text.value)
    );
  }

  static from(value: number | bigint | string): JsonNumber {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError('JsonNumber cannot hold NaN or Infinity');
      return new JsonNumber(JSON.stringify(value));
    }
    return new JsonNumber(String(value));
  }

  toString(): string {
    return this.text;
  }

  /** The nearest `number`; digits beyond double precision are lost. */
  valueOf(): number {
    return Number(this.text);
  }

  /** The exact text as a JSON string, for serializers other than the SDK's. */
  toJSON(): string {
    return this.text;
  }

  [inspect.custom](): string {
    return `JsonNumber(${this.text})`;
  }
}

const MAX_DEPTH = 512;
const WS = /[ \t\n\r]*/y;
const NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

class Parser {
  pos = 0;

  constructor(private readonly text: string) {}

  fail(): never {
    throw new SyntaxError(`Invalid JSON at position ${this.pos}`);
  }

  ws(): void {
    WS.lastIndex = this.pos;
    WS.exec(this.text);
    this.pos = WS.lastIndex;
  }

  value(depth: number): unknown {
    this.ws();
    const c = this.text.charCodeAt(this.pos);
    if (c === 0x7b) return this.object(depth + 1);
    if (c === 0x5b) return this.array(depth + 1);
    if (c === 0x22) return this.string();
    if (c === 0x2d || (c >= 0x30 && c <= 0x39)) return this.number();
    for (const [word, value] of LITERALS) {
      if (this.text.startsWith(word, this.pos)) {
        this.pos += word.length;
        return value;
      }
    }
    return this.fail();
  }

  object(depth: number): Record<string, unknown> {
    if (depth > MAX_DEPTH) this.fail();
    this.pos++;
    const out: Record<string, unknown> = {};
    this.ws();
    if (this.text.charCodeAt(this.pos) === 0x7d) {
      this.pos++;
      return out;
    }
    for (;;) {
      this.ws();
      if (this.text.charCodeAt(this.pos) !== 0x22) this.fail();
      const key = this.string();
      this.ws();
      if (this.text.charCodeAt(this.pos) !== 0x3a) this.fail();
      this.pos++;
      defineOwn(out, key, this.value(depth));
      this.ws();
      const c = this.text.charCodeAt(this.pos++);
      if (c === 0x7d) return out;
      if (c !== 0x2c) {
        this.pos--;
        this.fail();
      }
    }
  }

  array(depth: number): unknown[] {
    if (depth > MAX_DEPTH) this.fail();
    this.pos++;
    const out: unknown[] = [];
    this.ws();
    if (this.text.charCodeAt(this.pos) === 0x5d) {
      this.pos++;
      return out;
    }
    for (;;) {
      out.push(this.value(depth));
      this.ws();
      const c = this.text.charCodeAt(this.pos++);
      if (c === 0x5d) return out;
      if (c !== 0x2c) {
        this.pos--;
        this.fail();
      }
    }
  }

  string(): string {
    const text = this.text;
    let i = this.pos + 1;
    let escaped = false;
    for (;;) {
      const c = text.charCodeAt(i);
      if (c === 0x22) break;
      if (c === 0x5c) {
        escaped = true;
        i += 2;
      } else if (c < 0x20 || Number.isNaN(c)) {
        this.pos = i;
        this.fail();
      } else {
        i++;
      }
    }
    const raw = text.slice(this.pos, i + 1);
    this.pos = i + 1;
    // Escapes are validated and decoded by JSON.parse itself.
    return escaped ? (JSON.parse(raw) as string) : raw.slice(1, -1);
  }

  number(): number | JsonNumber {
    NUMBER.lastIndex = this.pos;
    const m = NUMBER.exec(this.text);
    if (!m) return this.fail();
    this.pos = NUMBER.lastIndex;
    const token = m[0];
    const n = Number(token);
    return String(n) === token ? n : new JsonNumber(token);
  }
}

const LITERALS: ReadonlyArray<readonly [string, unknown]> = [
  ['true', true],
  ['false', false],
  ['null', null],
];

function defineOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
  } else {
    target[key] = value;
  }
}

/**
 * Parses a JSON document without losing digits (see {@link JsonNumber}).
 * Throws a `SyntaxError` for any invalid document, one nested deeper than 512 levels included.
 */
export function parseJson(input: string | Buffer): unknown {
  const text = typeof input === 'string' ? input : input.toString('utf8');
  const parser = new Parser(text);
  const value = parser.value(0);
  parser.ws();
  if (parser.pos !== text.length) parser.fail();
  return value;
}

/**
 * Serializes like `JSON.stringify`, but writes `JsonNumber` and `bigint`
 * values as exact JSON numbers and rejects NaN and Infinity.
 */
export function stringifyJson(value: unknown): string {
  const tag = randomBytes(12).toString('hex');
  const raws: string[] = [];
  const out = JSON.stringify(value, function (this: Record<string, unknown>, key: string, v: unknown) {
    const original = this[key];
    if (original instanceof JsonNumber) {
      raws.push(original.text);
      return `\u0000${tag}:${raws.length - 1}\u0000`;
    }
    if (typeof v === 'bigint') {
      raws.push(v.toString());
      return `\u0000${tag}:${raws.length - 1}\u0000`;
    }
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new DidwwClientError('NaN and Infinity cannot be sent as JSON');
    }
    return v;
  });
  if (raws.length === 0) return out;
  return out.replace(new RegExp(`"\\\\u0000${tag}:(\\d+)\\\\u0000"`, 'g'), (_, i: string) => raws[Number(i)]);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep copy of arrays and plain objects. `Date` values are copied; any other
 * object, `JsonNumber` included, is immutable or not owned here and is kept as is.
 */
export function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneJson) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) defineOwn(out, key, cloneJson(value[key]));
    return out as T;
  }
  return value;
}

/** Replaces every `JsonNumber` in arrays and plain objects with its `number`. */
export function normalizeNumbers(value: unknown): unknown {
  if (value instanceof JsonNumber) return value.valueOf();
  if (Array.isArray(value)) return value.map(normalizeNumbers);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) defineOwn(out, key, normalizeNumbers(value[key]));
    return out;
  }
  return value;
}
