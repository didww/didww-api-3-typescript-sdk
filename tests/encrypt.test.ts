import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { encryptWithKeys, calculateFingerprint } from '../src/encrypt.js';

function generateTestKeyPair(): string {
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return publicKey as string;
}

describe('Encrypt', () => {
  const pemA = generateTestKeyPair();
  const pemB = generateTestKeyPair();
  const pems: [string, string] = [pemA, pemB];

  it('encrypts data producing a buffer', () => {
    const data = Buffer.from('hello world');
    const encrypted = encryptWithKeys(data, pems);
    expect(Buffer.isBuffer(encrypted)).toBe(true);
    expect(encrypted.length).toBeGreaterThan(data.length);
  });

  it('fingerprint has expected format (hex:::hex)', () => {
    const fingerprint = calculateFingerprint(pems);
    expect(fingerprint).toMatch(/^[0-9a-f]+:::[0-9a-f]+$/);
  });

  it('produces different output each time', () => {
    const data = Buffer.from('hello world');
    const encrypted1 = encryptWithKeys(data, pems);
    const encrypted2 = encryptWithKeys(data, pems);
    expect(encrypted1.equals(encrypted2)).toBe(false);
  });
});
