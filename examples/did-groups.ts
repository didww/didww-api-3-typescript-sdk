import { DidwwClient, Environment } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List DID groups with country include
  const didGroups = await client.didGroups().list({
    include: 'country',
    page: { size: 5 },
  });
  console.log(`Found ${didGroups.data.length} DID groups`);
  for (const group of didGroups.data) {
    console.log(`  ${group.prefix} - ${group.area_name} (metered: ${group.is_metered})`);
  }
}

main().catch(console.error);
