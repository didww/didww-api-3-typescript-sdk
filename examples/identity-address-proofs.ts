import { DidwwClient, Environment, IdentityType, ref } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Get a country to use
  const countries = await client.countries().list({ filter: { iso: 'US' } });
  if (countries.data.length === 0) {
    console.log('No countries found');
    return;
  }
  const country = countries.data[0];
  console.log(`Using country: ${country.name} (${country.id})`);

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
