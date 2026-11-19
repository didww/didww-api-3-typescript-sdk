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
    // numberType is a NumberType value (local, national, mobile, toll_free, shared_cost, global)
    console.log(`    Number type: ${group.numberType}, demo: ${group.isDemo}`);
    console.log(`    Features: ${group.features.join(', ')}`);
    console.log(`    Allow additional channels: ${group.allowAdditionalChannels}`);
    if (group.serviceRestrictions) console.log(`    Service restrictions: ${group.serviceRestrictions}`);
  }
}

main().catch(console.error);
