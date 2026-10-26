import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { DidwwClient, type DidwwClientOptions } from '../src/client.js';
import { DEFAULT_API_VERSION, ENVIRONMENT_ENDPOINTS, Environment, Scope } from '../src/configuration.js';
import { DidwwClientError } from '../src/errors.js';
import { MemoryTokenStore, DEFAULT_TOKEN_STORE } from '../src/auth/token-store.js';

const make = (options: Partial<DidwwClientOptions>) => () => new DidwwClient({ apiKey: 'key', ...options });

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DidwwClientError);
    return (e as Error).message;
  }
  throw new Error('expected a DidwwClientError');
}

describe('API key', () => {
  it.each([undefined, null, '', 42])('is required (%j)', (apiKey) => {
    expect(messageOf(() => new DidwwClient({ apiKey } as never))).toBe('apiKey is required');
  });

  it.each(['has space', ' lead', 'trail ', 'line\nbreak', 'tab\tinside', 'ctl\x01', 'del\x7f', 'café', 'quote’'])(
    'refuses %j without echoing it',
    (apiKey) => {
      const message = messageOf(make({ apiKey }));
      expect(message).toBe('apiKey contains characters not allowed in an HTTP header');
    },
  );

  it('accepts printable ASCII', () => {
    expect(make({ apiKey: 'Ab0-_.~!#$%&*+/=?^`{|}' })).not.toThrow();
  });
});

describe('environment and API version', () => {
  it('refuses an unknown environment', () => {
    expect(messageOf(make({ environment: 'https://example.com/v3/' as Environment }))).toBe(
      'environment must be Environment.SANDBOX or Environment.PRODUCTION',
    );
  });

  it('keeps the environment values', () => {
    expect(Environment.PRODUCTION).toBe('https://api.didww.com/v3/');
    expect(Environment.SANDBOX).toBe('https://sandbox-api.didww.com/v3/');
  });

  it('has the service endpoints of each environment', () => {
    expect(ENVIRONMENT_ENDPOINTS[Environment.SANDBOX]).toEqual({
      auth: 'https://auth-sandbox.didww.com',
      voiceInPrices: 'https://api-vin-sandbox.didww.com/v3',
      voiceOutPrices: 'https://api-vout-sandbox.didww.com/v3',
      smsPrices: 'https://api-sms-sandbox.didww.com/v3',
    });
    const sandbox = new DidwwClient({ apiKey: 'key' });
    expect(sandbox.voiceInPricesUrl).toBe('https://api-vin-sandbox.didww.com/v3');
    expect(sandbox.voiceOutPricesUrl).toBe('https://api-vout-sandbox.didww.com/v3');
    expect(sandbox.smsPricesUrl).toBe('https://api-sms-sandbox.didww.com/v3');
  });

  it('points an earlier API version to 3.x', () => {
    expect(messageOf(make({ apiVersion: '2026-04-16' }))).toBe(
      'API version 2026-04-16 is not supported: this SDK requires 2026-10-22 or later;' +
        ' use @didww/sdk 3.x (branch release-3) for 2026-04-16',
    );
  });

  it.each(['2026-4-1', '2026-10-22\n', '２０２６-10-22', '2026/10/22', 'latest'])(
    'refuses the malformed API version %j',
    (apiVersion) => {
      expect(messageOf(make({ apiVersion }))).toMatch(/^API version must be a YYYY-MM-DD date, got /);
    },
  );

  it('accepts the default and later versions', () => {
    expect(DEFAULT_API_VERSION).toBe('2026-10-22');
    expect(make({ apiVersion: '2027-01-01' })).not.toThrow();
  });

  it('accepts the scopes only', () => {
    expect(new DidwwClient({ apiKey: 'key', scope: Scope.READ }).scope).toBe('read');
    expect(new DidwwClient({ apiKey: 'key' }).scope).toBeNull();
    expect(messageOf(make({ scope: 'admin' as Scope }))).toBe("scope must be 'read' or 'full'");
  });
});

describe('service URLs', () => {
  const kinds = [
    ['baseUrl', 'API base'],
    ['authUrl', 'Token service'],
    ['voiceInPricesUrl', 'Voice IN prices'],
    ['voiceOutPricesUrl', 'Voice OUT prices'],
    ['smsPricesUrl', 'SMS prices'],
  ] as const;

  const invalid = [
    'ftp://example.com/v3',
    'https://',
    'https:///v3',
    'https://example.com/v3?x=1',
    'https://example.com/v3#f',
    'https://example.com /v3',
    'https://example.com/v3\t',
    'https://exa\nmple.com/v3',
    'https:\\\\example.com\\v3',
    'https://example.com:99999/v3',
    'example.com/v3',
  ];

  for (const [option, name] of kinds) {
    it.each(invalid)(`refuses ${option} %j`, (url) => {
      expect(messageOf(make({ [option]: url }))).toBe(
        `${name} URL must be an http or https URL without a query or fragment, got ${JSON.stringify(url)}`,
      );
    });

    it.each(['https://user:p#ss@example.com/v3', 'https://@example.com/v3', 'https://u:p@example.com/v3'])(
      `refuses user info in ${option} without echoing it (%j)`,
      (url) => {
        expect(messageOf(make({ [option]: url }))).toBe(
          `${name} URL must be an http or https URL without a query or fragment, got a URL with user info`,
        );
      },
    );
  }

  it('accepts http and https URLs and trims the trailing slash of the base and auth URLs', () => {
    const client = new DidwwClient({
      apiKey: 'key',
      baseUrl: 'http://127.0.0.1:8080/v3/',
      authUrl: 'https://auth.example.com/',
      voiceInPricesUrl: 'https://vin.example.com',
      voiceOutPricesUrl: 'https://vout.example.com/v3',
      smsPricesUrl: 'https://sms.example.com/v3/',
    });
    expect(client.baseUrl).toBe('http://127.0.0.1:8080/v3');
    expect(client.authUrl).toBe('https://auth.example.com');
    expect(client.voiceInPricesUrl).toBe('https://vin.example.com');
    expect(client.smsPricesUrl).toBe('https://sms.example.com/v3/');
  });
});

describe('timeouts', () => {
  it.each(['connectTimeout', 'readTimeout', 'timeout'] as const)('validates %s', (name) => {
    for (const value of [0, -1, NaN, Infinity, 2 ** 31, '1000', true]) {
      expect(messageOf(make({ [name]: value as never }))).toBe(
        `${name} must be a positive number of milliseconds up to 2147483647 or null`,
      );
    }
    expect(make({ [name]: 2 ** 31 - 1 })).not.toThrow();
    expect(make({ [name]: null })).not.toThrow();
    expect(make({ [name]: 1 })).not.toThrow();
  });
});

describe('token store, logger and agent', () => {
  it('requires get, set and delete of a token store', () => {
    for (const tokenStore of [{}, { get() {}, set() {} }, MemoryTokenStore, null, 'store']) {
      expect(messageOf(make({ tokenStore: tokenStore as never }))).toBe('tokenStore must provide get, set and delete');
    }
    const duck = { get: () => null, set: () => undefined, delete: () => undefined };
    expect(new DidwwClient({ apiKey: 'key', tokenStore: duck }).tokenStore).toBe(duck);
  });

  it('shares the default token store', () => {
    expect(new DidwwClient({ apiKey: 'key' }).tokenStore).toBe(DEFAULT_TOKEN_STORE);
  });

  it('requires a logger object with a logging method', () => {
    for (const logger of [{}, { log: () => undefined }, console.warn, 'console', null]) {
      expect(messageOf(make({ logger: logger as never }))).toBe(
        'logger must be an object with debug, info, warn or error methods',
      );
    }
    expect(make({ logger: console })).not.toThrow();
    expect(make({ logger: { warn: () => undefined } })).not.toThrow();
  });

  it('requires an agent', () => {
    expect(messageOf(make({ agent: {} as never }))).toBe('agent must be an http.Agent');
    expect(messageOf(make({ agent: null as never }))).toBe('agent must be an http.Agent');
    expect(make({ agent: new http.Agent({ keepAlive: true }) })).not.toThrow();
  });
});
