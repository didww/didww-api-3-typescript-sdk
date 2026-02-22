import { DidwwClient, Environment, ref } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Create an identity
  const identity = await client.identities().create({
    identity_type: 'Personal',
    first_name: 'John',
    last_name: 'Doe',
    phone_number: '+1234567890',
    id_number: 'AB123456',
    country: ref('countries', 'some-country-id'),
  });
  console.log('Identity created:', identity.data.id);

  // Create an address
  const address = await client.addresses().create({
    city_name: 'London',
    postal_code: 'SW1A 1AA',
    address: '10 Downing Street',
    description: 'Test address',
    country: ref('countries', 'some-country-id'),
    identity: ref('identities', identity.data.id),
  });
  console.log('Address created:', address.data.id);

  // Create an address verification
  const verification = await client.addressVerifications().create({
    service_description: 'Test service',
    address: ref('addresses', address.data.id),
    dids: [ref('dids', 'some-did-id')],
  });
  console.log('Verification created:', verification.data.id);
  console.log('Status:', verification.data.status);
}

main().catch(console.error);
