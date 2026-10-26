import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { DidwwClient } from '../src/client.js';
import { Encrypt } from '../src/encrypt.js';
import { AccessToken } from '../src/auth/access-token.js';
import { MemoryTokenStore } from '../src/auth/token-store.js';
import { AuthErrorKind, DidwwAuthError, DidwwClientError } from '../src/errors.js';

const API_KEY = 'secret-api-key-0123456789';
const TOKEN = 'secret-access-token-0123456789';

const shown = (value: unknown) => [
  inspect(value, { depth: 10 }),
  inspect(value, { depth: 10, showHidden: true }),
  JSON.stringify(value) ?? '',
  String(value),
];

describe('secrets', () => {
  it('never shows the API key of a client, its repositories or Encrypt', () => {
    const client = new DidwwClient({ apiKey: API_KEY });
    for (const value of [client, client.dids(), client.balance(), new Encrypt(client), { client }]) {
      for (const text of shown(value)) expect(text).not.toContain(API_KEY);
    }
    expect(Object.keys(client)).toEqual([]);
    expect(JSON.parse(JSON.stringify(client))).toEqual({
      environment: 'https://sandbox-api.didww.com/v3/',
      baseUrl: 'https://sandbox-api.didww.com/v3',
      authUrl: 'https://auth-sandbox.didww.com',
      apiVersion: '2026-10-22',
      scope: null,
    });
    expect(inspect(client)).toMatch(/^DidwwClient \{/);
    expect('apiKey' in client).toBe(false);
  });

  it('never shows the access token, except through accessToken and toData', () => {
    const token = new AccessToken({ accessToken: TOKEN, aud: 'api.didww.com', expiresIn: 900 });
    for (const text of shown(token)) {
      expect(text).not.toContain(TOKEN);
      expect(text).toContain('[FILTERED]');
    }
    expect({ ...token }).not.toHaveProperty('accessToken');
    expect(Object.entries(token).map(([k]) => k)).not.toContain('accessToken');
    expect(token.accessToken).toBe(TOKEN);
    expect(token.toData().access_token).toBe(TOKEN);
  });

  it('never shows the tokens of a memory store', () => {
    const store = new MemoryTokenStore();
    store.set('k', new AccessToken({ accessToken: TOKEN }), 0);
    for (const text of shown(store)) expect(text).not.toContain(TOKEN);
    expect(inspect(store)).toBe('MemoryTokenStore { entries: 1 }');
    expect(JSON.stringify(store)).toBe('{"entries":1}');
  });

  it('builds token errors without secrets', () => {
    const error = new DidwwAuthError({ kind: AuthErrorKind.INVALID_CLIENT, status: 401, error: 'invalid_client' });
    expect(error.message).toBe('Token service: invalid_client');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DidwwAuthError');
    expect(error.cause).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(new DidwwClientError('x'), 'cause')).toBe(false);
  });
});

describe('AccessToken', () => {
  it('is immutable', () => {
    const token = new AccessToken({ accessToken: TOKEN, aud: ['api.didww.com'] });
    expect(Object.isFrozen(token)).toBe(true);
    expect(Object.isFrozen(token.aud)).toBe(true);
    expect(token.tokenType).toBe('Bearer');
    expect(token.expiresIn).toBe(0);
    expect(token.scope).toBeNull();
  });

  it('round-trips through toData and fromData', () => {
    const mintedAt = new Date('2026-10-22T08:05:03.123Z');
    const token = new AccessToken({
      accessToken: TOKEN,
      expiresIn: 900,
      aud: ['api.didww.com', 'api-sms.didww.com'],
      scope: 'read',
      apiVersion: '2026-10-22',
      mintedAt,
    });
    const data = JSON.parse(JSON.stringify(token.toData()));
    expect(data).toEqual({
      access_token: TOKEN,
      token_type: 'Bearer',
      expires_in: 900,
      aud: ['api.didww.com', 'api-sms.didww.com'],
      scope: 'read',
      api_version: '2026-10-22',
      minted_at: '2026-10-22T08:05:03.123Z',
    });
    const back = AccessToken.fromData(data);
    expect(back.accessToken).toBe(TOKEN);
    expect(back.aud).toEqual(token.aud);
    expect(back.mintedAt?.getTime()).toBe(mintedAt.getTime());
  });

  it('accepts aud as a string and ignores unknown keys and a malformed minted_at', () => {
    const token = AccessToken.fromData({ access_token: TOKEN, aud: 'api.didww.com', extra: 1, minted_at: 'today' });
    expect(token.aud).toEqual(['api.didww.com']);
    expect(token.mintedAt).toBeNull();
  });

  it.each([
    [null, 'token data must be an object'],
    [{ access_token: 1 }, 'access_token must be a string'],
    [{ access_token: TOKEN, expires_in: '900' }, 'expires_in must be a non-negative integer'],
    [{ access_token: TOKEN, expires_in: 1.5 }, 'expires_in must be a non-negative integer'],
    [{ access_token: TOKEN, aud: [1] }, 'aud must be a string or an array of strings'],
    [{ access_token: TOKEN, scope: 1 }, 'scope must be a string'],
  ])('refuses %j without echoing the token', (data, message) => {
    expect(() => AccessToken.fromData(data)).toThrow(new TypeError(message));
  });
});

describe('MemoryTokenStore', () => {
  it('drops a token at its expiry and keeps one without expiry', () => {
    let now = 0;
    const store = new MemoryTokenStore({ now: () => now });
    const token = new AccessToken({ accessToken: TOKEN });
    store.set('a', token, 10);
    store.set('b', token, 0);
    now = 9_999;
    expect(store.get('a')).toBe(token);
    now = 10_000;
    expect(store.get('a')).toBeNull();
    now = 1e12;
    expect(store.get('b')).toBe(token);
    store.delete('b');
    expect(store.get('b')).toBeNull();
    store.set('c', token, 5);
    store.clear();
    expect(store.size).toBe(0);
  });
});
