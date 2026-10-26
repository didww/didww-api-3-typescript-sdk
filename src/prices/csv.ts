import { DidwwClientError } from '../errors.js';

const FIELD_START = 0;
const UNQUOTED = 1;
const QUOTED = 2;
const QUOTE_IN_QUOTED = 3;

const COMMA = 0x2c;
const QUOTE = 0x22;
const CR = 0x0d;
const LF = 0x0a;

// These limits bound the memory a damaged file can take; a price file record
// has 15 short fields.
/** A field above this many characters is refused. */
export const MAX_FIELD_LENGTH = 1 << 20;
/** A record above this many fields is refused. */
export const MAX_FIELDS = 1024;
/** A record whose fields add up to more than this many characters is refused. */
export const MAX_RECORD_LENGTH = 1 << 22;

const UNQUOTED_STOP = /[,\r\n"]/g;

export interface CsvRecord {
  fields: string[];
  /** The line the record starts on, from 1. */
  line: number;
}

/**
 * An RFC 4180 parser fed with text in pieces. Records end at LF, CRLF or a
 * lone CR; line breaks inside quotes are kept as they are; `""` inside quotes
 * is a quote. Empty lines are skipped. A quote inside an unquoted field, text
 * after a closing quote and an unterminated quote are errors.
 */
export class CsvParser {
  #state = FIELD_START;
  #field = '';
  #record: string[] = [];
  #recordLength = 0;
  #empty = true;
  #skipLf = false;
  #line = 1;
  #recordLine = 1;

  /** Parses `text` and appends the records it completes to `out`. */
  push(text: string, out: CsvRecord[]): void {
    let i = 0;
    const n = text.length;
    if (this.#skipLf && n > 0) {
      this.#skipLf = false;
      if (text.charCodeAt(0) === LF) i = 1;
    }
    while (i < n) {
      switch (this.#state) {
        case FIELD_START:
          if (text.charCodeAt(i) === QUOTE) {
            this.#state = QUOTED;
            this.#empty = false;
            i++;
          } else {
            this.#state = UNQUOTED;
          }
          break;
        case UNQUOTED: {
          UNQUOTED_STOP.lastIndex = i;
          const m = UNQUOTED_STOP.exec(text);
          const end = m === null ? n : m.index;
          if (end > i) this.#append(text.slice(i, end));
          if (m === null) {
            i = n;
            break;
          }
          const c = text.charCodeAt(end);
          i = end + 1;
          if (c === COMMA) {
            this.#endField();
          } else if (c === QUOTE) {
            throw this.#error('a quote inside an unquoted field');
          } else {
            i = this.#endRecord(text, i, c, out);
          }
          break;
        }
        case QUOTED: {
          const q = text.indexOf('"', i);
          const end = q === -1 ? n : q;
          if (end > i) {
            const part = text.slice(i, end);
            this.#append(part);
            for (let at = part.indexOf('\n'); at !== -1; at = part.indexOf('\n', at + 1)) this.#line++;
          }
          if (q === -1) {
            i = n;
          } else {
            this.#state = QUOTE_IN_QUOTED;
            i = q + 1;
          }
          break;
        }
        case QUOTE_IN_QUOTED: {
          const c = text.charCodeAt(i);
          i++;
          if (c === QUOTE) {
            this.#append('"');
            this.#state = QUOTED;
          } else if (c === COMMA) {
            this.#endField();
          } else if (c === CR || c === LF) {
            i = this.#endRecord(text, i, c, out);
          } else {
            throw this.#error('text after a closing quote');
          }
          break;
        }
      }
    }
  }

  /** Ends the input; appends the last record, if any, to `out`. */
  end(out: CsvRecord[]): void {
    if (this.#state === QUOTED) throw this.#error('a quoted field is not terminated');
    if (!this.#empty) this.#finish(out);
  }

  #append(part: string): void {
    this.#empty = false;
    this.#field += part;
    this.#recordLength += part.length;
    if (this.#field.length > MAX_FIELD_LENGTH) throw this.#error('a field is too long');
    if (this.#recordLength > MAX_RECORD_LENGTH) throw this.#error('the record is too long');
  }

  #endField(): void {
    // A comma always starts one more field.
    if (this.#record.length + 1 >= MAX_FIELDS) throw this.#error('too many fields');
    this.#record.push(this.#field);
    this.#field = '';
    this.#empty = false;
    this.#state = FIELD_START;
  }

  // Ends the record at the line break `c` just read; returns the position after it.
  #endRecord(text: string, i: number, c: number, out: CsvRecord[]): number {
    if (c === CR) {
      if (i < text.length) {
        if (text.charCodeAt(i) === LF) i++;
      } else {
        this.#skipLf = true;
      }
    }
    if (!this.#empty) this.#finish(out);
    this.#state = FIELD_START;
    this.#line++;
    this.#recordLine = this.#line;
    return i;
  }

  #finish(out: CsvRecord[]): void {
    this.#record.push(this.#field);
    out.push({ fields: this.#record, line: this.#recordLine });
    this.#record = [];
    this.#recordLength = 0;
    this.#field = '';
    this.#empty = true;
    this.#state = FIELD_START;
  }

  #error(reason: string): DidwwClientError {
    return new DidwwClientError(`price file record on line ${this.#recordLine}: ${reason}`);
  }
}
