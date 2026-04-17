import { DidwwClient, Environment, IdentityType, ref, isIncluded } from '../src/index.js';
import type { Country } from '../src/resources/country.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // List identities (include country + birth_country, 2026-04-16 adds birth_country)
  console.log('=== Identities ===');
  const identities = await client.identities().list({
    include: ['country', 'birth_country'],
  });
  console.log(`Found ${identities.data.length} identities`);

  for (const ident of identities.data.slice(0, 10)) {
    console.log(`\nIdentity: ${ident.id}`);
    console.log(`  Name: ${ident.firstName} ${ident.lastName}`);
    console.log(`  Phone: ${ident.phoneNumber}`);
    console.log(`  Type: ${ident.identityType}`);
    if (ident.country && isIncluded(ident.country)) {
      console.log(`  Country: ${(ident.country as Country).name}`);
    }
    if (ident.birthCountry && isIncluded(ident.birthCountry)) {
      console.log(`  Birth Country: ${(ident.birthCountry as Country).name}`); // 2026-04-16
    }
    console.log(`  Birth Date: ${ident.birthDate}`);
    console.log(`  Verified: ${ident.verified}`);
    console.log(`  Created: ${ident.createdAt}`);
  }

  // Get a country to use
  const countries = await client.countries().list({ filter: { iso: 'US' } });
  if (countries.data.length === 0) {
    console.log('No countries found');
    return;
  }
  const country = countries.data[0];
  console.log(`\nUsing country: ${country.name} (${country.id})`);

  // Create an identity
  const identity = await client.identities().create({
    identityType: IdentityType.PERSONAL,
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '1234567890',
    idNumber: 'AB123456',
    country: ref('countries', country.id),
  });
  console.log(`Identity created: ${identity.data.id}`);

  // Create an address
  const address = await client.addresses().create({
    cityName: 'New York',
    postalCode: '10001',
    address: '123 Main Street',
    description: 'Test address',
    country: ref('countries', country.id),
    identity: ref('identities', identity.data.id),
  });
  console.log(`Address created: ${address.data.id}`);

  // Clean up
  await client.addresses().remove(address.data.id);
  console.log('Address deleted');
  await client.identities().remove(identity.data.id);
  console.log('Identity deleted');
}

main().catch(console.error);
