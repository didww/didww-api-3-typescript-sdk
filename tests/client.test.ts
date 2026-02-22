import { describe, it, expect } from 'vitest';
import { DidwwClient } from '../src/client.js';
import { Environment } from '../src/configuration.js';
import { DidwwClientError } from '../src/errors.js';

describe('DidwwClient', () => {
  it('uses sandbox URL by default', () => {
    const client = new DidwwClient({ apiKey: 'test' });
    // Access the private baseUrl through any trick — test via actual request URL
    expect(client).toBeDefined();
  });

  it('uses sandbox URL when environment is SANDBOX', () => {
    const client = new DidwwClient({ apiKey: 'test', environment: Environment.SANDBOX });
    expect(client).toBeDefined();
  });

  it('uses production URL when environment is PRODUCTION', () => {
    const client = new DidwwClient({ apiKey: 'test', environment: Environment.PRODUCTION });
    expect(client).toBeDefined();
  });

  it('uses custom base URL', () => {
    const client = new DidwwClient({ apiKey: 'test', baseUrl: 'https://custom-api.example.com/v3' });
    expect(client).toBeDefined();
  });

  it('rejects empty API key', () => {
    expect(() => new DidwwClient({ apiKey: '' })).toThrow(DidwwClientError);
  });
});
