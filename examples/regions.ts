import { DidwwClient, Environment } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List regions filtered by country, with included country
  const regions = await client.regions().list({
    filter: { 'country.id': '1f6fc2bd-f081-4202-9b1a-d9cb88d942b9' },
    include: 'country',
    sort: '-name',
  });
  console.log(`Found ${regions.data.length} regions`);
  for (const region of regions.data) {
    console.log(`  ${region.id} - ${region.name}`);
  }

  // Find a specific region with included country
  if (regions.data.length > 0) {
    const region = await client.regions().find(regions.data[0].id, {
      include: 'country',
    });
    console.log(`\nRegion details: ${region.data.name}`);
  }
}

main().catch(console.error);
