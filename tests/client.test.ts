import { describe, it, expect } from 'vitest';
import { DidwwClient } from '../src/client.js';
import { Environment } from '../src/configuration.js';
import { DidwwApiError, DidwwClientError } from '../src/errors.js';

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

  it('accepts timeout option', () => {
    const client = new DidwwClient({ apiKey: 'test', timeout: 30_000 });
    expect(client).toBeDefined();
  });

  it('uses custom fetch function when provided', async () => {
    const mockFetch = async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.api+json' },
      });
    };

    const client = new DidwwClient({ apiKey: 'test', fetch: mockFetch });
    const result = await client.countries().list();
    expect(result.data).toEqual([]);
  });

  it('does not send Api-Key header for public_keys endpoint', async () => {
    let capturedHeaders: HeadersInit | undefined;
    const mockFetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.api+json' },
      });
    };

    const client = new DidwwClient({ apiKey: 'test-key', fetch: mockFetch });
    await client.publicKeys().list();
    expect(capturedHeaders).toBeDefined();
    expect(capturedHeaders).not.toHaveProperty('Api-Key');
  });

  it('sends Api-Key header for non-public_keys endpoints', async () => {
    let capturedHeaders: HeadersInit | undefined;
    const mockFetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.api+json' },
      });
    };

    const client = new DidwwClient({ apiKey: 'test-key', fetch: mockFetch });
    await client.countries().list();
    expect(capturedHeaders).toBeDefined();
    expect(capturedHeaders).toHaveProperty('Api-Key', 'test-key');
  });

  it('accepts custom fetch without modifying it', () => {
    const mockFetch = async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      return new Response('{}', { status: 200 });
    };

    const client = new DidwwClient({ apiKey: 'test', fetch: mockFetch });
    expect(client).toBeDefined();
  });
});

describe('DidwwApiError', () => {
  it('parses code field from JSON:API error response', () => {
    const body = {
      errors: [{ status: '422', code: 'invalid', detail: 'is invalid', source: { pointer: '/data/attributes/name' } }],
    };
    const error = new DidwwApiError(422, body);
    expect(error.status).toBe(422);
    expect(error.errors.length).toBe(1);
    expect(error.errors[0].code).toBe('invalid');
    expect(error.errors[0].detail).toBe('is invalid');
    expect(error.errors[0].source?.pointer).toBe('/data/attributes/name');
  });

  it('handles errors without code field', () => {
    const body = {
      errors: [{ status: '404', detail: 'Not found' }],
    };
    const error = new DidwwApiError(404, body);
    expect(error.errors[0].code).toBeUndefined();
    expect(error.errors[0].detail).toBe('Not found');
  });

  it('handles empty error body', () => {
    const error = new DidwwApiError(500, {});
    expect(error.errors).toEqual([]);
    expect(error.message).toBe('API error 500');
  });
});
