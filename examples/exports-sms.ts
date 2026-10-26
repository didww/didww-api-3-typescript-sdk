/**
 * SMS exports: creates sms_out and sms_in exports for yesterday and reads the
 * columns of a completed SMS-Out export, downloaded in memory.
 *
 * Filters on SMS exports (ExportFilters):
 *   - from, to (required): "YYYY-MM-DD HH:MM:SS" in UTC; from inclusive,
 *     to exclusive and not in the future
 *   - sourceAddressEq / sourceAddressCont, destinationAddressEq /
 *     destinationAddressCont, status, smsId
 *   - 'smsTrunk.id': one id or a list of ids
 *   - sms_in only: trunkType, one or a list of ExportTrunkType values
 *   - sms_out only: serviceType ("a2p" or "p2p"), 'senderIdVerification.id'
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/exports-sms.ts
 */
import { DidwwApiError, DidwwClient, Environment, ExportStatus, ExportTrunkType, ExportType } from '../src/index.js';
import type { ExportFilters } from '../src/index.js';
import crypto from 'node:crypto';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

const suffix = crypto.randomBytes(4).toString('hex');

// Both bounds come from one UTC midnight, so "to" is never in the future
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const day = (d: Date) => d.toISOString().slice(0, 10);
const dateFrom = `${day(yesterday)} 00:00:00`; // inclusive
const dateTo = `${day(today)} 00:00:00`; // exclusive

async function create(exportType: ExportType, filters: ExportFilters, externalReferenceId: string) {
  try {
    const created = await client.exports().create({ exportType, filters, externalReferenceId });
    // The file URL is set once the export is completed: find the export again later to download it.
    console.log(`Created ${exportType} export: ${created.data.id} (status: ${created.data.status})`);
  } catch (e) {
    if (!(e instanceof DidwwApiError)) throw e;
    console.log(`Error creating ${exportType} export: ${e.message}`);
  }
}

async function main() {
  console.log('=== Creating SMS-Out Export (A2P, yesterday) ===');
  await create(ExportType.SMS_OUT, { from: dateFrom, to: dateTo, serviceType: 'a2p' }, `ts-sms-out-${suffix}`);

  console.log('\n=== Creating SMS-In Export (HTTP IN and email trunks, yesterday) ===');
  const inFilters: ExportFilters = {
    from: dateFrom,
    to: dateTo,
    trunkType: [ExportTrunkType.HTTP_IN, ExportTrunkType.EMAIL],
  };
  // 'smsTrunk.id' takes one id or a list of ids
  const trunks = await client.smsTrunks().list({ page: { number: 1, size: 2 } });
  if (trunks.data.length > 0) {
    inFilters['smsTrunk.id'] = trunks.data.map((t) => t.id);
  }
  await create(ExportType.SMS_IN, inFilters, `ts-sms-in-${suffix}`);

  console.log('\n=== Completed SMS-Out exports ===');
  const completed = await client.exports().list({
    filter: { export_type: ExportType.SMS_OUT, status: ExportStatus.COMPLETED },
  });
  console.log(`Found ${completed.data.length} completed SMS-Out exports`);

  const exp = completed.data[0];
  if (exp?.url) {
    // The export file is a gzip-compressed CSV; download it decompressed into
    // memory and read its header line.
    const csv = await client.downloadAndDecompressExport(exp.url);
    const header = csv
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/, 1)[0];
    console.log(`Export ${exp.id} (${exp.exportType}) columns: ${header}`);
  }
}

main().catch(console.error);
