import { createHmac, timingSafeEqual } from 'node:crypto';

export class RequestValidator {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  validate(url: string, payload: Record<string, string>, signature: string): boolean {
    if (!signature) return false;
    const expected = this.computeSignature(url, payload);
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  computeSignature(url: string, payload: Record<string, string>): string {
    const normalizedUrl = this.normalizeUrl(url);
    const sortedKeys = Object.keys(payload).sort();
    let data = normalizedUrl;
    for (const key of sortedKeys) {
      data += key + payload[key];
    }
    const hmac = createHmac('sha1', this.apiKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    let port: string;
    if (parsed.port) {
      port = `:${parsed.port}`;
    } else if (parsed.protocol === 'https:') {
      port = ':443';
    } else {
      port = ':80';
    }
    const base = `${parsed.protocol}//${parsed.username ? parsed.username + '@' : ''}${parsed.hostname}${port}${parsed.pathname}`;
    const search = parsed.search || '';
    const hash = parsed.hash || '';
    return `${base}${search}${hash}`;
  }
}
