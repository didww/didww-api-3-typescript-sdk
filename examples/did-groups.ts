import { DidwwClient, Environment, isIncluded } from '../src/index.js';
import type { Country, StockKeepingUnit } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List DID groups with country and stock keeping units
  const didGroups = await client.didGroups().list({
    include: 'country,stock_keeping_units',
    page: { size: 5 },
  });
  console.log(`Found ${didGroups.data.length} DID groups`);
  for (const group of didGroups.data) {
    const country = isIncluded<Country>(group.country) ? group.country : undefined;
    const skus = (group.stockKeepingUnits || []).filter((s): s is StockKeepingUnit => isIncluded(s));
    console.log(`  ${group.prefix} - ${group.areaName} (${country?.name ?? 'unknown'}, ${skus.length} SKUs)`);
  }
}

main().catch(console.error);
