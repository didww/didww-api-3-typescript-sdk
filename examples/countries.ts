import { DidwwClient, Environment } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List all countries
  const countries = await client.countries().list();
  console.log(`Found ${countries.data.length} countries`);
  for (const country of countries.data.slice(0, 5)) {
    console.log(`  ${country.iso} - ${country.name} (+${country.prefix})`);
  }

  // Find a specific country
  if (countries.data.length > 0) {
    const country = await client.countries().find(countries.data[0].id);
    console.log(`\nCountry details: ${country.data.name}`);
  }
}

main().catch(console.error);
