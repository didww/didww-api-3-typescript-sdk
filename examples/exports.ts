/**
 * Exports: create and list CDR exports.
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/exports.ts
 */
import { DidwwClient, Environment, ExportType } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Create an export
  const exp = await client.exports().create({
    exportType: ExportType.CDR_IN,
    filters: { year: 2025, month: 1 },
  });
  console.log(`Created export: ${exp.data.id}`);
  console.log(`  type: ${exp.data.exportType}`);
  console.log(`  status: ${exp.data.status}`);
  console.log(`  createdAt: ${exp.data.createdAt}`);

  // List all exports
  const exports = await client.exports().list();
  console.log(`\nAll exports (${exports.data.length}):`);
  for (const e of exports.data) {
    console.log(`  ${e.id} type=${e.exportType} status=${e.status}`);
  }

  // Find the specific export
  const found = await client.exports().find(exp.data.id);
  console.log(`\nFound export: ${found.data.id} status=${found.data.status}`);
}

main().catch(console.error);
