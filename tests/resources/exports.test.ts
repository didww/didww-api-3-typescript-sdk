import { describe, it, expect, afterEach } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette, cleanupNock } from '../helpers/vcr.js';

describe('Exports', () => {
  afterEach(() => cleanupNock());

  it('lists exports', async () => {
    loadCassette('exports/list.yaml');
    const client = createTestClient();
    const result = await client.exports().list();
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('finds an export', async () => {
    loadCassette('exports/show.yaml');
    const client = createTestClient();
    const result = await client.exports().find('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.id).toBe('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.status).toBe('Completed');
    expect(result.data.exportType).toBe('cdr_in');
  });

  it('creates an export', async () => {
    loadCassette('exports/create.yaml');
    const client = createTestClient();
    const result = await client.exports().create({
      exportType: 'cdr_in',
      filters: { did_number: '1234556789', year: '2019', month: '01' },
    });
    expect(result.data.id).toBe('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.status).toBe('Pending');
  });

  it('creates a cdr_out export', async () => {
    loadCassette('exports/create_1.yaml');
    const client = createTestClient();
    const result = await client.exports().create({
      exportType: 'cdr_out',
      filters: { year: '2019', month: '01' },
    });
    expect(result.data.id).toBe('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.status).toBe('Pending');
    expect(result.data.exportType).toBe('cdr_out');
  });

  it('downloads an export', async () => {
    loadCassette('exports/download.yaml');
    const client = createTestClient();
    const buffer = await client.downloadExport(
      'https://sandbox-api.didww.com/v3/exports/02bf6df4-3af9-416c-96be-16e5b7eeb651.csv.gz',
    );
    // Verify gzip magic bytes
    expect(buffer[0]).toBe(0x1f);
    expect(buffer[1]).toBe(0x8b);
  });

  it('downloads and decompresses an export', async () => {
    loadCassette('exports/download_decompress.yaml');
    const client = createTestClient();
    const buffer = await client.downloadAndDecompressExport(
      'https://sandbox-api.didww.com/v3/exports/02bf6df4-3af9-416c-96be-16e5b7eeb651.csv.gz',
    );
    const content = buffer.toString('utf-8');
    expect(content).toContain('Date/Time Start (UTC)');
    expect(content).toContain('972397239159652');
  });
});
