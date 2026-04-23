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
    console.log(`\n  ${group.prefix} - ${group.areaName} (${country?.name ?? 'unknown'}, ${skus.length} SKUs)`);
    console.log(`    Features: ${group.features.join(', ')}`); // 2026-04-16 adds p2p / a2p / emergency / cnam_out
    console.log(`    Allow additional channels: ${group.allowAdditionalChannels}`);
    if (group.serviceRestrictions) console.log(`    Service restrictions: ${group.serviceRestrictions}`); // 2026-04-16
  }
}

main().catch(console.error);
