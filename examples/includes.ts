import { DidwwClient, Environment, isIncluded } from '../src/index.js';
import type { Country, Region, DidGroup, VoiceInTrunk, StockKeepingUnit } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // --- Regions with included country ---
  console.log('=== Regions with country ===');
  const regions = await client.regions().list({
    include: 'country',
    page: { size: 3 },
  });
  for (const region of regions.data) {
    const country = isIncluded<Country>(region.country) ? region.country : undefined;
    console.log(`  ${region.name} (${region.iso}) — country: ${country?.name}`);
  }

  // --- DID groups with included stock keeping units ---
  console.log('\n=== DID groups with SKUs ===');
  const groups = await client.didGroups().list({
    include: 'stock_keeping_units',
    page: { size: 3 },
  });
  for (const group of groups.data) {
    const skus = (group.stockKeepingUnits || []).filter((s): s is StockKeepingUnit => isIncluded(s));
    console.log(`  ${group.prefix} ${group.areaName} — ${skus.length} SKU(s)`);
    for (const sku of skus) {
      console.log(`    $${sku.monthlyPrice}/mo, ${sku.channelsIncludedCount} channels`);
    }
  }

  // --- Available DIDs with nested includes ---
  console.log('\n=== Available DIDs with did_group.stock_keeping_units ===');
  const available = await client.availableDids().list({
    include: 'did_group.stock_keeping_units',
    page: { size: 3 },
  });
  for (const ad of available.data) {
    const didGroup = isIncluded<DidGroup>(ad.didGroup) ? ad.didGroup : undefined;
    const skus = didGroup?.stockKeepingUnits?.filter((s): s is StockKeepingUnit => isIncluded(s)) || [];
    console.log(`  ${ad.number} — group: ${didGroup?.prefix} ${didGroup?.areaName}, ${skus.length} SKU(s)`);
  }

  // --- DIDs with voice trunk ---
  console.log('\n=== DIDs with voice_in_trunk ===');
  const dids = await client.dids().list({
    include: 'voice_in_trunk',
    page: { size: 3 },
  });
  for (const did of dids.data) {
    const trunk = isIncluded<VoiceInTrunk>(did.voiceInTrunk) ? did.voiceInTrunk : undefined;
    console.log(`  ${did.number} — trunk: ${trunk?.name ?? '(none)'}`);
  }

  // --- Cities with country and region ---
  console.log('\n=== Cities with country and region ===');
  const cities = await client.cities().list({
    include: 'country,region',
    page: { size: 3 },
  });
  for (const city of cities.data) {
    const country = isIncluded<Country>(city.country) ? city.country : undefined;
    const region = isIncluded<Region>(city.region) ? city.region : undefined;
    console.log(`  ${city.name} — ${region?.name ?? '(no region)'}, ${country?.name}`);
  }
}

main().catch(console.error);
