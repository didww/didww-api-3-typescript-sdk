/**
 * Webhook signature validation: checks that a callback comes from DIDWW.
 *
 * DIDWW signs every callback with the callback secret enabled in the User Panel
 * and sends the signature in the X-DIDWW-Signature header. This example builds
 * a sample callback (URL and payload), signs it the way DIDWW does, and checks
 * it with RequestValidator: the signed callback is valid, the same callback
 * with a changed payload value is not. It sends no API request, so it needs
 * no API key.
 *
 * Usage: npx tsx examples/webhook.ts
 */
import { createHmac } from 'node:crypto';
import { RequestValidator } from '../src/index.js';

const CALLBACK_SECRET = 'your-callback-secret';

// The callback URL as RequestValidator normalizes it: the port written out (443 for https,
// 80 for http), credentials, path, query and fragment kept, an IPv6 host in brackets
function normalizedUrl(url: string): string {
  const parsed = new URL(url);
  let port = '';
  if (parsed.port) port = `:${parsed.port}`;
  else if (parsed.protocol === 'https:') port = ':443';
  else if (parsed.protocol === 'http:') port = ':80';
  let auth = '';
  if (parsed.username && parsed.password) auth = `${parsed.username}:${parsed.password}@`;
  else if (parsed.username) auth = `${parsed.username}@`;
  const host =
    parsed.hostname.startsWith('[') || !parsed.hostname.includes(':') ? parsed.hostname : `[${parsed.hostname}]`;
  return `${parsed.protocol}//${auth}${host}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

// HMAC-SHA1 with the callback secret, hex-encoded, over the normalized callback
// URL followed by every payload key and value, keys in UTF-16 code unit order as
// RequestValidator sorts them (localeCompare would order mixed-case keys differently).
function signLikeDidww(secret: string, url: string, payload: Record<string, string>): string {
  let data = normalizedUrl(url);
  for (const key of Object.keys(payload).sort((a, b) => Number(a > b) - Number(a < b))) {
    data += key + payload[key];
  }
  return createHmac('sha1', secret).update(data).digest('hex');
}

const validator = new RequestValidator(CALLBACK_SECRET);

// The callback as your webhook handler receives it: the full original URL and
// the payload key-value pairs
const callbackUrl = 'https://example.com/didww/callbacks?source=orders';
const payload: Record<string, string> = {
  id: '7c3f9a52-1d4e-4b8a-9f61-2e5d8c0b4a17',
  type: 'orders',
  status: 'completed',
};
const signature = signLikeDidww(CALLBACK_SECRET, callbackUrl, payload);
console.log(`Callback URL: ${callbackUrl}`);
console.log(`Payload: ${JSON.stringify(payload)}`);
console.log(`X-DIDWW-Signature: ${signature}`);

const valid = validator.validate(callbackUrl, payload, signature);
console.log(`\nSigned callback -> valid: ${valid}`);

// The same signature with a payload value changed on the way
const tampered = { ...payload, status: 'canceled' };
const tamperedValid = validator.validate(callbackUrl, tampered, signature);
console.log(`Tampered payload -> valid: ${tamperedValid}`);

if (!valid || tamperedValid) {
  console.error('\nUnexpected result: the signed callback must be valid and the tampered one invalid');
  process.exitCode = 1;
}
