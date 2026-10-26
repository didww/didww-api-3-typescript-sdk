import { describe, it, expect } from 'vitest';
import nock from 'nock';
import { createTestClient, setupClient, TEST_ACCESS_TOKEN } from '../helpers/client.js';
import pkg from '../../package.json';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';
import { ExportTrunkType, ExportType } from '../../src/enums.js';

describe('Exports', () => {
  describeOperationEnforcement({
    clientMethod: 'exports',
    allowedOperations: ['list', 'find', 'create', 'update', 'remove'],
    resourceType: 'exports',
  });
  it('lists exports', async () => {
    const client = setupClient('exports/list.yaml');
    const result = await client.exports().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].externalReferenceId).toBe('exp-ref-001');
  });

  it('finds an export', async () => {
    const client = setupClient('exports/show.yaml');
    const result = await client.exports().find('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.id).toBe('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.status).toBe('completed');
    expect(result.data.exportType).toBe('cdr_in');
  });

  it('creates an export', async () => {
    const client = setupClient('exports/create.yaml');
    const result = await client.exports().create({
      exportType: 'cdr_in',
      filters: { didNumber: '1234556789', from: '2019-01-01 00:00:00', to: '2019-01-31 23:59:59' },
    });
    expect(result.data.id).toBe('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.status).toBe('pending');
  });

  it('updates external_reference_id on an export', async () => {
    const client = setupClient('exports/update.yaml');
    const result = await client.exports().update({
      id: 'da15f006-5da4-45ca-b0df-735baeadf423',
      externalReferenceId: 'updated-exp-ref',
    });
    expect(result.data.id).toBe('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.externalReferenceId).toBe('updated-exp-ref');
  });

  it('creates a cdr_out export', async () => {
    const client = setupClient('exports/create_1.yaml');
    const result = await client.exports().create({
      exportType: 'cdr_out',
      filters: { from: '2019-01-01 00:00:00', to: '2019-01-31 23:59:59' },
    });
    expect(result.data.id).toBe('da15f006-5da4-45ca-b0df-735baeadf423');
    expect(result.data.status).toBe('pending');
    expect(result.data.exportType).toBe('cdr_out');
  });

  it('creates an sms_in export', async () => {
    const client = setupClient('exports/create_sms_in.yaml');
    const result = await client.exports().create({
      exportType: ExportType.SMS_IN,
      filters: {
        from: '2026-10-01 00:00:00',
        to: '2026-10-15 00:00:00',
        trunkType: [ExportTrunkType.SMPP_SMSC, ExportTrunkType.HTTP_IN],
        destinationAddressEq: '12125550100',
      },
    });
    expect(result.data.exportType).toBe(ExportType.SMS_IN);
    expect(result.data.filters.trunkType).toEqual(['SMPP SMSC', 'HTTP IN']);
    expect(result.data.filters.destinationAddressEq).toBe('12125550100');
  });

  it('creates an sms_out export with dotted filter keys', async () => {
    const client = setupClient('exports/create_sms_out.yaml');
    const result = await client.exports().create({
      exportType: ExportType.SMS_OUT,
      filters: {
        from: '2026-10-01 00:00:00',
        to: '2026-10-15 00:00:00',
        'smsTrunk.id': ['b2c3d4e5-0000-4000-8000-000000000001', 'b2c3d4e5-0000-4000-8000-000000000003'],
        serviceType: 'a2p',
        'senderIdVerification.id': 'c3d4e5f6-0000-4000-8000-000000000002',
      },
    });
    expect(result.data.exportType).toBe(ExportType.SMS_OUT);
    expect(result.data.filters['smsTrunk.id']).toHaveLength(2);
    expect(result.data.filters['senderIdVerification.id']).toBe('c3d4e5f6-0000-4000-8000-000000000002');
    expect(result.data.filters.serviceType).toBe('a2p');
  });

  it('downloads an export', async () => {
    const client = setupClient('exports/download.yaml');
    const buffer = await client.downloadExport(
      'https://sandbox-api.didww.com/v3/exports/02bf6df4-3af9-416c-96be-16e5b7eeb651.csv.gz',
    );
    // Verify gzip magic bytes
    expect(buffer[0]).toBe(0x1f);
    expect(buffer[1]).toBe(0x8b);
  });

  it('downloads and decompresses an export', async () => {
    const client = setupClient('exports/download_decompress.yaml');
    const buffer = await client.downloadAndDecompressExport(
      'https://sandbox-api.didww.com/v3/exports/02bf6df4-3af9-416c-96be-16e5b7eeb651.csv.gz',
    );
    const content = buffer.toString('utf-8');
    expect(content).toContain('Date/Time Start (UTC)');
    expect(content).toContain('972397239159652');
  });

  describe('export download headers', () => {
    async function downloadExportAndCaptureHeaders(): Promise<Record<string, string | string[] | undefined>> {
      let captured: Record<string, string | string[] | undefined> = {};
      nock('https://sandbox-api.didww.com')
        .get('/v3/exports/test.csv.gz')
        .reply(function () {
          captured = this.req.headers;
          return [200, Buffer.from([0x1f, 0x8b]), { 'Content-Type': 'application/octet-stream' }];
        });
      await createTestClient().downloadExport('https://sandbox-api.didww.com/v3/exports/test.csv.gz');
      return captured;
    }

    it('sends the bearer token and User-Agent, and neither Api-Key nor X-DIDWW-API-Version', async () => {
      const headers = await downloadExportAndCaptureHeaders();
      expect(headers.authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
      expect(headers['user-agent']).toBe(`didww-typescript-sdk/${pkg.version}`);
      expect(headers['api-key']).toBeUndefined();
      expect(headers['x-didww-api-version']).toBeUndefined();
    });

    it('asks for the file unencoded and sends no Content-Type or Accept headers', async () => {
      const headers = await downloadExportAndCaptureHeaders();
      expect(headers['accept-encoding']).toBe('identity');
      expect(headers['content-type']).toBeUndefined();
      expect(headers.accept).toBeUndefined();
    });
  });
});
