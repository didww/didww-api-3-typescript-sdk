// HTTP header values of the prices services: IMF-fixdate and Content-Disposition.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IMF_FIXDATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), ([0-9]{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([0-9]{4}) ([0-9]{2}):([0-9]{2}):([0-9]{2}) GMT$/;
const PARAM = /;[ \t]*([^\s=;]+)[ \t]*=[ \t]*("(?:[^"\\]|\\.)*"?|[^;]*)/g;
const EXTENDED = /^([A-Za-z0-9!#$%&+^_`{}~-]+)'[^']*'([\x21-\x7e]*)$/;

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** A UTC date from its components, years below 100 included; null when a component overflows. */
export function utcDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date | null {
  const date = new Date(Date.UTC(2000, month - 1, day, hour, minute, second, ms));
  date.setUTCFullYear(year, month - 1, day);
  const exact =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second;
  return exact ? date : null;
}

/** Whether `date` is a valid Date whose UTC year is 1 to 9999, so it can be sent as an IMF-fixdate. */
export function isHttpDate(date: unknown): date is Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= 1 && year <= 9999;
}

/** `date` as an IMF-fixdate (`Thu, 01 Oct 2026 08:05:03 GMT`), in whole seconds. */
export function formatHttpDate(date: Date): string {
  const d = new Date(Math.floor(date.getTime() / 1000) * 1000);
  return (
    `${DAYS[d.getUTCDay()]}, ${pad(d.getUTCDate(), 2)} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCFullYear(), 4)} ` +
    `${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}:${pad(d.getUTCSeconds(), 2)} GMT`
  );
}

/** An IMF-fixdate as a Date; null for anything else, a wrong weekday or an obsolete format included. */
export function parseHttpDate(value: string | string[] | undefined): Date | null {
  if (typeof value !== 'string') return null;
  const m = IMF_FIXDATE.exec(value.replace(/^[ \t]+|[ \t]+$/g, ''));
  if (m === null) return null;
  const date = utcDate(Number(m[4]), MONTHS.indexOf(m[3]) + 1, Number(m[2]), Number(m[5]), Number(m[6]), Number(m[7]));
  if (date === null || DAYS[date.getUTCDay()] !== m[1]) return null;
  return date;
}

/** The file name of a Content-Disposition: `filename*` (UTF-8 or ISO-8859-1) when valid, else `filename`. */
export function contentDispositionFilename(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || value === '') return null;
  let plain: string | null = null;
  let extended: string | null = null;
  let extendedSeen = false;
  for (const m of value.matchAll(PARAM)) {
    const name = m[1].toLowerCase();
    let raw = m[2].replace(/^[ \t]+|[ \t]+$/g, '');
    if (raw.startsWith('"')) {
      raw = raw.length > 1 && raw.endsWith('"') ? raw.slice(1, -1) : raw.slice(1);
      raw = raw.replace(/\\(.)/g, '$1');
    }
    if (name === 'filename' && plain === null) {
      plain = raw;
    } else if (name === 'filename*' && !extendedSeen) {
      extendedSeen = true;
      extended = decodeExtended(raw);
    }
  }
  const name = extended ?? plain;
  return name ? name : null;
}

function decodeExtended(value: string): string | null {
  const m = EXTENDED.exec(value);
  if (m === null) return null;
  const charset = m[1].toLowerCase();
  if (charset !== 'utf-8' && charset !== 'iso-8859-1') return null;
  const encoded = m[2];
  if (/%(?![0-9A-Fa-f]{2})/.test(encoded)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  if (charset === 'iso-8859-1') return Buffer.from(bytes).toString('latin1');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}
