import { inspect } from 'node:util';

const FILTERED = '[FILTERED]';
const MINTED_AT_RE =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

/** Marks every `AccessToken`, so that a token built by another copy of the SDK (ESM and CJS) is recognised. */
export const ACCESS_TOKEN_BRAND: unique symbol = Symbol.for('@didww/sdk.AccessToken');

/** An access token under its wire names, as `toData()` returns it. It holds the token: protect it like the API key. */
export interface AccessTokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
  aud: string[];
  scope: string | null;
  api_version: string | null;
  minted_at: string | null;
}

export interface AccessTokenInit {
  accessToken: string;
  tokenType?: string;
  /** Seconds the token is valid for, counted from `mintedAt`. */
  expiresIn?: number;
  aud?: string | readonly string[];
  scope?: string | null;
  apiVersion?: string | null;
  mintedAt?: Date | null;
}

/**
 * An access token granted by the token service. Immutable.
 *
 * `util.inspect`, `JSON.stringify` and `toString` never show the token;
 * `accessToken` and `toData()` do, so that a `TokenStore` can persist it.
 */
export class AccessToken {
  readonly #accessToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
  readonly aud: readonly string[];
  readonly scope: string | null;
  readonly apiVersion: string | null;
  readonly mintedAt: Date | null;

  constructor(init: AccessTokenInit) {
    if (typeof init?.accessToken !== 'string') throw new TypeError('accessToken must be a string');
    this.#accessToken = init.accessToken;
    this.tokenType = init.tokenType ?? 'Bearer';
    this.expiresIn = init.expiresIn ?? 0;
    const aud = init.aud ?? [];
    this.aud = Object.freeze(typeof aud === 'string' ? [aud] : [...aud]);
    this.scope = init.scope ?? null;
    this.apiVersion = init.apiVersion ?? null;
    this.mintedAt = init.mintedAt ? new Date(init.mintedAt.getTime()) : null;
    Object.defineProperty(this, ACCESS_TOKEN_BRAND, { value: true });
    Object.freeze(this);
  }

  get accessToken(): string {
    return this.#accessToken;
  }

  /** The token under its wire names, `minted_at` as ISO 8601; it includes the access token. */
  toData(): AccessTokenData {
    return {
      access_token: this.#accessToken,
      token_type: this.tokenType,
      expires_in: this.expiresIn,
      aud: [...this.aud],
      scope: this.scope,
      api_version: this.apiVersion,
      minted_at: this.mintedAt && !Number.isNaN(this.mintedAt.getTime()) ? this.mintedAt.toISOString() : null,
    };
  }

  /**
   * Builds a token from `toData()` output; unknown keys are ignored. Throws a
   * `TypeError` for a value of the wrong type; the message never contains the token.
   */
  static fromData(data: unknown): AccessToken {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('token data must be an object');
    }
    const d = data as Record<string, unknown>;
    if (typeof d.access_token !== 'string') throw new TypeError('access_token must be a string');
    const expiresIn = d.expires_in ?? 0;
    if (typeof expiresIn !== 'number' || !Number.isSafeInteger(expiresIn) || expiresIn < 0) {
      throw new TypeError('expires_in must be a non-negative integer');
    }
    const aud = d.aud ?? [];
    if (typeof aud !== 'string' && !(Array.isArray(aud) && aud.every((a) => typeof a === 'string'))) {
      throw new TypeError('aud must be a string or an array of strings');
    }
    for (const name of ['token_type', 'scope', 'api_version'] as const) {
      if (d[name] !== undefined && d[name] !== null && typeof d[name] !== 'string') {
        throw new TypeError(`${name} must be a string`);
      }
    }
    return new AccessToken({
      accessToken: d.access_token,
      tokenType: (d.token_type as string | null | undefined) || 'Bearer',
      expiresIn,
      aud: aud as string | string[],
      scope: (d.scope as string | null | undefined) ?? null,
      apiVersion: (d.api_version as string | null | undefined) ?? null,
      mintedAt: parseMintedAt(d.minted_at),
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      accessToken: FILTERED,
      tokenType: this.tokenType,
      expiresIn: this.expiresIn,
      aud: [...this.aud],
      scope: this.scope,
      apiVersion: this.apiVersion,
      mintedAt: this.mintedAt,
    };
  }

  toString(): string {
    return `AccessToken ${inspect(this.toJSON(), { breakLength: Infinity })}`;
  }

  [inspect.custom](): string {
    return this.toString();
  }
}

function parseMintedAt(value: unknown): Date | null {
  if (typeof value !== 'string' || !MINTED_AT_RE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
