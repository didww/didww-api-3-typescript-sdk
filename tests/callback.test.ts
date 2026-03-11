import { describe, it, expect } from 'vitest';
import { RequestValidator } from '../src/callback/request-validator.js';

describe('RequestValidator', () => {
  const defaultKey = 'SOMEAPIKEY';
  const defaultPayload = {
    status: 'completed',
    id: '1dd7a68b-e235-402b-8912-fe73ee14243a',
    type: 'orders',
  };

  const validationCases: {
    name: string;
    key: string;
    url: string;
    payload: Record<string, string>;
    signature: string;
    expected: boolean;
  }[] = [
    {
      name: 'validates sandbox callback signature',
      key: defaultKey,
      url: 'http://example.com/callback.php?id=7ae7c48f-d48a-499f-9dc1-c9217014b457&reject_reason=&status=approved&type=address_verifications', // NOSONAR
      payload: {
        status: 'approved',
        id: '7ae7c48f-d48a-499f-9dc1-c9217014b457',
        type: 'address_verifications',
        reject_reason: '',
      },
      signature: '18050028b6b22d0ed516706fba1c1af8d6a8f9d5',
      expected: true,
    },
    {
      name: 'validates a valid request',
      key: defaultKey,
      url: 'http://example.com/callbacks', // NOSONAR
      payload: defaultPayload,
      signature: 'fe99e416c3547f2f59002403ec856ea386d05b2f',
      expected: true,
    },
    {
      name: 'validates a request with query and fragment',
      key: 'OTHERAPIKEY',
      url: 'http://example.com/callbacks?foo=bar#baz', // NOSONAR
      payload: defaultPayload,
      signature: '32754ba93ac1207e540c0cf90371e7786b3b1cde',
      expected: true,
    },
    {
      name: 'rejects empty signature',
      key: defaultKey,
      url: 'http://example.com/callbacks', // NOSONAR
      payload: defaultPayload,
      signature: '',
      expected: false,
    },
    {
      name: 'rejects invalid signature',
      key: defaultKey,
      url: 'http://example.com/callbacks', // NOSONAR
      payload: defaultPayload,
      signature: 'fbdb1d1b18aa6c08324b7d64b71fb76370690e1d',
      expected: false,
    },
  ];

  validationCases.forEach(({ name, key, url, payload, signature, expected }) => {
    it(name, () => {
      const validator = new RequestValidator(key);
      expect(validator.validate(url, payload, signature)).toBe(expected);
    });
  });

  it('treats https default port 443 equivalently to explicit :443', () => {
    const validator = new RequestValidator(defaultKey);
    const payload = defaultPayload;
    const sigWithout = validator.computeSignature('https://example.com/callbacks', payload);
    const sigWith = validator.computeSignature('https://example.com:443/callbacks', payload);
    expect(sigWithout).toBe(sigWith);
    expect(validator.validate('https://example.com/callbacks', payload, sigWithout)).toBe(true);
  });

  it('produces identical signatures regardless of payload key insertion order', () => {
    const validator = new RequestValidator(defaultKey);
    const url = 'http://example.com/callbacks'; // NOSONAR
    const payloadAsc = { id: 'abc', status: 'completed', type: 'orders' };
    const payloadDesc = { type: 'orders', status: 'completed', id: 'abc' };
    expect(validator.computeSignature(url, payloadAsc)).toBe(validator.computeSignature(url, payloadDesc));
  });

  it('returns false for an invalid URL instead of throwing', () => {
    const validator = new RequestValidator(defaultKey);
    expect(validator.validate('not a valid url', defaultPayload, 'abcd1234')).toBe(false);
  });

  describe('URL normalization test vectors', () => {
    const key = defaultKey;
    const payload = {
      id: '1dd7a68b-e235-402b-8912-fe73ee14243a',
      status: 'completed',
      type: 'orders',
    };

    const vectors: [string, string, string][] = [
      ['http://foo.com/bar', 'http://foo.com:80/bar', '4d1ce2be656d20d064183bec2ab98a2ff3981f73'], // NOSONAR
      ['http://foo.com:80/bar', 'http://foo.com:80/bar', '4d1ce2be656d20d064183bec2ab98a2ff3981f73'], // NOSONAR
      ['http://foo.com:443/bar', 'http://foo.com:443/bar', '904eaa65c0759afac0e4d8912de424e2dfb96ea1'], // NOSONAR
      ['http://foo.com:8182/bar', 'http://foo.com:8182/bar', 'eb8fcfb3d7ed4b4c2265d73cf93c31ba614384d1'], // NOSONAR

      ['http://foo.com/bar?baz=boo', 'http://foo.com:80/bar?baz=boo', '78b00717a86ce9df06abf45ff818aa94537e1729'], // NOSONAR
      ['http://user:pass@foo.com/bar', 'http://user:pass@foo.com:80/bar', '88615a11a78c021c1da2e1e0bfb8cc165170afc5'], // NOSONAR
      ['http://foo.com/bar#test', 'http://foo.com:80/bar#test', 'b1c4391fcdab7c0521bb5b9eb4f41f08529b8418'], // NOSONAR
      ['https://foo.com/bar', 'https://foo.com:443/bar', 'f26a771c302319a7094accbe2989bad67fff2928'],
      ['https://foo.com:443/bar', 'https://foo.com:443/bar', 'f26a771c302319a7094accbe2989bad67fff2928'],
      ['https://foo.com:80/bar', 'https://foo.com:80/bar', 'bd45af5253b72f6383c6af7dc75250f12b73a4e1'],
      ['https://foo.com:8384/bar', 'https://foo.com:8384/bar', '9c9fec4b7ebd6e1c461cb8e4ffe4f2987a19a5d3'],
      ['https://foo.com/bar?qwe=asd', 'https://foo.com:443/bar?qwe=asd', '4a0e98ddf286acadd1d5be1b0ed85a4e541c3137'],
      ['https://qwe:asd@foo.com/bar', 'https://qwe:asd@foo.com:443/bar', '7a8cd4a6c349910dfecaf9807e56a63787250bbd'],
      ['https://foo.com/bar#baz', 'https://foo.com:443/bar#baz', '5024919770ea5ca2e3ccc07cb940323d79819508'],

      // IPv6 vectors
      ['http://[::1]/bar', 'http://[::1]:80/bar', 'e0e9b83e4046d097f54b3ae64b08cbb4a539f601'], // NOSONAR
      ['http://[::1]:80/bar', 'http://[::1]:80/bar', 'e0e9b83e4046d097f54b3ae64b08cbb4a539f601'], // NOSONAR
      ['http://[::1]:9090/bar', 'http://[::1]:9090/bar', 'ebec110ec5debd0e0fd086ff2f02e48ca665b543'], // NOSONAR
      ['https://[::1]/bar', 'https://[::1]:443/bar', 'f3cfe6f523fdf1d4eaadc310fcd3ed92e1e324b0'],

      // Empty path and percent-encoded vectors
      ['http://foo.com', 'http://foo.com:80/', '6e9bb224f621d9bf735e80b45d69af688900e7d2'], // NOSONAR
      ['http://foo.com/', 'http://foo.com:80/', '6e9bb224f621d9bf735e80b45d69af688900e7d2'], // NOSONAR
      ['http://foo.com/hello%20world', 'http://foo.com:80/hello%20world', 'eb64035b2e8f356ff1442898a39ec94d5c3e2fc8'], // NOSONAR
      ['http://foo.com/foo%2Fbar', 'http://foo.com:80/foo%2Fbar', 'db24428442b012fa0972a453ba1ba98e755bba10'], // NOSONAR
    ];

    vectors.forEach(([inputUrl, expectedUrl, expectedSig]) => {
      it(`normalizes ${inputUrl} to ${expectedUrl}`, () => {
        const validator = new RequestValidator(key);
        const sig = validator.computeSignature(inputUrl, payload);
        const canonicalSig = validator.computeSignature(expectedUrl, payload);
        expect(sig).toBe(expectedSig);
        expect(canonicalSig).toBe(expectedSig);
        expect(sig).toBe(canonicalSig);
        expect(validator.validate(inputUrl, payload, expectedSig)).toBe(true);
      });
    });
  });
});
