/**
 * Exports: create and list CDR exports (cdr_in / cdr_out).
 *
 * external_reference_id is a customer-supplied reference (max 100 chars).
 *
 * Filter semantics on CDR exports ("YYYY-MM-DD HH:MM:SS" in UTC; "to" must not be in the future):
 *   - filters.from: lower bound, INCLUSIVE (server: time_start >= from)
 *   - filters.to:   upper bound, EXCLUSIVE (server: time_start <  to)
 * To cover a whole day, pass from: "2026-04-15 00:00:00", to: "2026-04-16 00:00:00".
 *
 * The file URL is set once the export is completed: find the export again
 * later and download it (see exports-sms.ts).
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/exports.ts
 */
import { DidwwClient, Environment, ExportType } from '../src/index.js';
import type { Export } from '../src/index.js';
import crypto from 'node:crypto';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

function printExport(exp: Export) {
  console.log(`Export: ${exp.id}`);
  console.log(`  Type: ${exp.exportType}`);
  console.log(`  Status: ${exp.status}`);
  console.log(`  Created: ${exp.createdAt}`);
  if (exp.url) console.log(`  URL: ${exp.url}`);
  if (exp.callbackUrl) console.log(`  Callback URL: ${exp.callbackUrl}`);
  if (exp.externalReferenceId) console.log(`  External Reference: ${exp.externalReferenceId}`);
  console.log('');
}

function printExportDetails(exp: Export) {
  console.log(`Export: ${exp.id}`);
  console.log(`  Type: ${exp.exportType}`);
  console.log(`  Status: ${exp.status}`);
  console.log(`  Created: ${exp.createdAt}`);
  if (exp.externalReferenceId) {
    console.log(`  External Reference: ${exp.externalReferenceId}`);
  }
  if (exp.filters) {
    console.log('  Filters:');
    if (exp.filters.from) console.log(`    From (inclusive): ${exp.filters.from}`);
    if (exp.filters.to) console.log(`    To (exclusive):   ${exp.filters.to}`);
  }
}

async function main() {
  // List existing exports
  console.log('=== Existing Exports ===');
  const exports = await client.exports().list();
  console.log(`Found ${exports.data.length} exports`);

  for (const exp of exports.data.slice(0, 5)) {
    printExport(exp);
  }

  // Create a CDR-In export for yesterday (from is inclusive, to is exclusive)
  console.log('\n=== Creating CDR-In Export (yesterday) ===');
  // Both bounds come from one UTC midnight, so "to" is never in the future
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const suffix = crypto.randomBytes(4).toString('hex');

  const cdrIn = await client.exports().create({
    exportType: ExportType.CDR_IN,
    filters: {
      from: `${fmtDate(yesterday)} 00:00:00`, // inclusive (time_start >= this)
      to: `${fmtDate(today)} 00:00:00`, // exclusive (time_start < this)
    },
    externalReferenceId: `ts-cdr-in-${suffix}`,
  });
  console.log(`Created CDR-In export: ${cdrIn.data.id}`);
  console.log(`  External Reference: ${cdrIn.data.externalReferenceId}`);
  console.log(`  Status: ${cdrIn.data.status}`);

  // Find and inspect a specific export
  if (exports.data.length > 0) {
    console.log('\n=== Specific Export Details ===');
    const specific = await client.exports().find(exports.data[0].id);
    printExportDetails(specific.data);
  }
}

await main();
