import { DidwwClientError } from '../errors.js';
import { utcDate } from './http-headers.js';

/** The category of a Voice OUT price. An unknown value is kept as the served string. */
export enum VoiceOutPriceCategory {
  INTERNATIONAL = 'International',
  ORIGIN_BASED = 'Origin based',
  LOCAL = 'Local',
}

// Money is a decimal string as served, with its scale (`"0.075000"`); it is
// never converted to a number. Use a decimal library for arithmetic.

/** A Voice IN price: one answer per source type and destination country. */
export interface VoiceInPrice {
  readonly id: string;
  readonly destination: string;
  readonly country: string | null;
  readonly srcCountryName: string | null;
  readonly sourceType: string;
  readonly rate: string | null;
  readonly connectionFee: string | null;
  readonly initialInterval: number;
  readonly nextInterval: number;
  readonly rejectCalls: boolean;
}

/** A Voice OUT price; the `next*` fields and `effectiveAt` describe a scheduled change. */
export interface VoiceOutPrice {
  readonly id: string;
  readonly category: VoiceOutPriceCategory | (string & {});
  readonly country: string | null;
  readonly network: string | null;
  readonly prefix: string;
  readonly rate: string | null;
  readonly connectionFee: string | null;
  readonly initialIncrement: number;
  readonly recurringIncrement: number;
  readonly rejectCalls: boolean;
  readonly nextRate: string | null;
  readonly nextConnectionFee: string | null;
  readonly nextInitialIncrement: number | null;
  readonly nextRecurringIncrement: number | null;
  /** An RFC 3339 date-time, as served. */
  readonly effectiveAt: string | null;
  readonly comment: string | null;
}

/** An SMS OUT price. */
export interface SmsOutPrice {
  /** Derived from the row content: a change, the price included, gives a new id, so it does not follow a destination over time. */
  readonly id: string;
  readonly sourcePrefix: string | null;
  readonly destinationPrefix: string | null;
  readonly country: string | null;
  readonly mcc: number | null;
  readonly mccName: string | null;
  readonly mnc: number | null;
  readonly mncName: string | null;
  readonly rejectSms: boolean;
  readonly price: string | null;
}

/** An SMS IN price. */
export interface SmsInPrice {
  /** Derived from the row content: a change, the price included, gives a new id, so it does not follow a destination over time. */
  readonly id: string;
  readonly sourcePrefix: string | null;
  readonly sourceNumberLengthMin: number;
  readonly sourceNumberLengthMax: number;
  readonly destinationPrefix: string | null;
  readonly destinationNumberLengthMin: number;
  readonly destinationNumberLengthMax: number;
  readonly country: string | null;
  readonly price: string;
}

/** The answer of a price lookup: at least one row, as no match is `PRICE_NOT_FOUND`; `totalRecords` is 0 when not given. */
export interface PriceLookup<Row> {
  readonly rows: readonly Row[];
  readonly totalRecords: number;
}

class ParseError extends Error {}

type Convert = (value: unknown) => unknown;

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/;

const string: Convert = (value) => {
  if (typeof value !== 'string') throw new ParseError('is not a string');
  return value;
};

const integer: Convert = (value) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new ParseError('is not an integer');
  return value;
};

const boolean: Convert = (value) => {
  if (typeof value !== 'boolean') throw new ParseError('is not a boolean');
  return value;
};

const money: Convert = (value) => {
  if (typeof value !== 'string' || !DECIMAL.test(value)) throw new ParseError('is not a decimal string');
  return value;
};

const dateTime: Convert = (value) => {
  const m = DATE_TIME.exec(string(value) as string);
  const valid =
    m !== null &&
    utcDate(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) !== null &&
    (m[7] === undefined || (Number(m[7]) <= 23 && Number(m[8]) <= 59));
  if (!valid) throw new ParseError('is not an RFC 3339 date-time');
  return value;
};

interface Field {
  attribute: string;
  property: string;
  convert: Convert;
  nullable: boolean;
}

const field = (attribute: string, convert: Convert, nullable = false): Field => ({
  attribute,
  property: attribute.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
  convert,
  nullable,
});

export type RowFields = readonly Field[];

export const VOICE_IN_FIELDS: RowFields = [
  field('destination', string),
  field('country', string, true),
  field('src_country_name', string, true),
  field('source_type', string),
  field('rate', money, true),
  field('connection_fee', money, true),
  field('initial_interval', integer),
  field('next_interval', integer),
  field('reject_calls', boolean),
];

export const VOICE_OUT_FIELDS: RowFields = [
  field('category', string),
  field('country', string, true),
  field('network', string, true),
  field('prefix', string),
  field('rate', money, true),
  field('connection_fee', money, true),
  field('initial_increment', integer),
  field('recurring_increment', integer),
  field('reject_calls', boolean),
  field('next_rate', money, true),
  field('next_connection_fee', money, true),
  field('next_initial_increment', integer, true),
  field('next_recurring_increment', integer, true),
  field('effective_at', dateTime, true),
  field('comment', string, true),
];

export const SMS_OUT_FIELDS: RowFields = [
  field('source_prefix', string, true),
  field('destination_prefix', string, true),
  field('country', string, true),
  field('mcc', integer, true),
  field('mcc_name', string, true),
  field('mnc', integer, true),
  field('mnc_name', string, true),
  field('reject_sms', boolean),
  field('price', money, true),
];

export const SMS_IN_FIELDS: RowFields = [
  field('source_prefix', string, true),
  field('source_number_length_min', integer),
  field('source_number_length_max', integer),
  field('destination_prefix', string, true),
  field('destination_number_length_min', integer),
  field('destination_number_length_max', integer),
  field('country', string, true),
  field('price', money),
];

function fail(reason: string): DidwwClientError {
  return new DidwwClientError(`Failed to parse price lookup: ${reason}`);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Builds a frozen `PriceLookup` from a parsed JSON:API document; every non-nullable attribute must be present. */
export function parseLookup<Row>(document: unknown, fields: RowFields): PriceLookup<Row> {
  if (!isObject(document)) throw fail('the answer is not a JSON:API document');
  const data = document.data;
  if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
    throw fail('the answer holds no prices');
  }
  if (!Array.isArray(data)) throw fail('data is not an array');
  const rows = Object.freeze(data.map((item, index) => parseRow(item, index, fields) as Row));
  return Object.freeze({ rows, totalRecords: totalRecords(document.meta) });
}

function parseRow(item: unknown, index: number, fields: RowFields): Readonly<Record<string, unknown>> {
  if (!isObject(item)) throw fail(`data[${index}] is not a resource object`);
  const id = item.id;
  if (typeof id !== 'string' || id === '') throw fail(`data[${index}] has no id`);
  const attributes = item.attributes;
  if (!isObject(attributes)) throw fail(`data[${index}].attributes is not an object`);
  const row: Record<string, unknown> = { id };
  for (const f of fields) row[f.property] = parseField(attributes, index, f);
  return Object.freeze(row);
}

function parseField(attributes: Record<string, unknown>, index: number, f: Field): unknown {
  const value = Object.hasOwn(attributes, f.attribute) ? attributes[f.attribute] : undefined;
  if (value === null || value === undefined) {
    if (!f.nullable) throw fail(`data[${index}].attributes.${f.attribute} is missing`);
    return null;
  }
  try {
    return f.convert(value);
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    throw fail(`data[${index}].attributes.${f.attribute} ${e.message}`);
  }
}

function totalRecords(meta: unknown): number {
  if (meta === null || meta === undefined) return 0;
  if (!isObject(meta)) throw fail('meta is not an object');
  const total = meta.total_records;
  if (total === null || total === undefined) return 0;
  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
    throw fail('meta.total_records is not a non-negative integer');
  }
  return total;
}
