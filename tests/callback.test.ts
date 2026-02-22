import { describe, it, expect } from 'vitest';
import { RequestValidator } from '../src/callback/request-validator.js';

describe('RequestValidator', () => {
  const apiKey = 'test-api-key';
  const validator = new RequestValidator(apiKey);

  it('computes a signature', () => {
    const url = 'https://example.com/callback';
    const payload = { key1: 'value1', key2: 'value2' };
    const sig = validator.computeSignature(url, payload);
    expect(sig).toBeDefined();
    expect(typeof sig).toBe('string');
  });

  it('validates a correct signature', () => {
    const url = 'https://example.com/callback';
    const payload = { key1: 'value1' };
    const sig = validator.computeSignature(url, payload);
    expect(validator.validate(url, payload, sig)).toBe(true);
  });

  it('rejects an incorrect signature', () => {
    const url = 'https://example.com/callback';
    const payload = { key1: 'value1' };
    expect(validator.validate(url, payload, 'invalid-signature')).toBe(false);
  });

  it('rejects empty signature', () => {
    const url = 'https://example.com/callback';
    const payload = { key1: 'value1' };
    expect(validator.validate(url, payload, '')).toBe(false);
  });

  it('sorts payload keys alphabetically', () => {
    const url = 'https://example.com/callback';
    const payload1 = { b: '2', a: '1' };
    const payload2 = { a: '1', b: '2' };
    const sig1 = validator.computeSignature(url, payload1);
    const sig2 = validator.computeSignature(url, payload2);
    expect(sig1).toBe(sig2);
  });
});
