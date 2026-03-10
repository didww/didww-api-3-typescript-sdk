import { describe, it, expect } from 'vitest';
import { RequestValidator } from '../src/callback/request-validator.js';

describe('RequestValidator', () => {
  it('validates sandbox callback signature', () => {
    const validator = new RequestValidator('SOMEAPIKEY');
    const url = 'http://example.com/callback.php?id=7ae7c48f-d48a-499f-9dc1-c9217014b457&reject_reason=&status=approved&type=address_verifications';
    const payload = {
      status: 'approved',
      id: '7ae7c48f-d48a-499f-9dc1-c9217014b457',
      type: 'address_verifications',
      reject_reason: '',
    };
    const signature = '18050028b6b22d0ed516706fba1c1af8d6a8f9d5';
    expect(validator.validate(url, payload, signature)).toBe(true);
  });

  it('validates a valid request', () => {
    const validator = new RequestValidator('SOMEAPIKEY');
    const url = 'http://example.com/callbacks';
    const payload = {
      status: 'completed',
      id: '1dd7a68b-e235-402b-8912-fe73ee14243a',
      type: 'orders',
    };
    const signature = 'fe99e416c3547f2f59002403ec856ea386d05b2f';
    expect(validator.validate(url, payload, signature)).toBe(true);
  });

  it('validates a request with query and fragment', () => {
    const validator = new RequestValidator('OTHERAPIKEY');
    const url = 'http://example.com/callbacks?foo=bar#baz';
    const payload = {
      status: 'completed',
      id: '1dd7a68b-e235-402b-8912-fe73ee14243a',
      type: 'orders',
    };
    const signature = '32754ba93ac1207e540c0cf90371e7786b3b1cde';
    expect(validator.validate(url, payload, signature)).toBe(true);
  });

  it('rejects empty signature', () => {
    const validator = new RequestValidator('SOMEAPIKEY');
    const url = 'http://example.com/callbacks';
    const payload = {
      status: 'completed',
      id: '1dd7a68b-e235-402b-8912-fe73ee14243a',
      type: 'orders',
    };
    expect(validator.validate(url, payload, '')).toBe(false);
  });

  it('rejects invalid signature', () => {
    const validator = new RequestValidator('SOMEAPIKEY');
    const url = 'http://example.com/callbacks';
    const payload = {
      status: 'completed',
      id: '1dd7a68b-e235-402b-8912-fe73ee14243a',
      type: 'orders',
    };
    expect(validator.validate(url, payload, 'fbdb1d1b18aa6c08324b7d64b71fb76370690e1d')).toBe(false);
  });
});
