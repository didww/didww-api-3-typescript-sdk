/**
 * Validates an emergency calling service order before placing it (2026-04-16).
 *
 * EmergencyRequirementValidation is a write-only endpoint: POST the
 * intended (emergency_requirement, address, identity) triple and the server
 * either returns 204 No Content (OK to order) or JSON:API errors describing
 * what the customer must fix (missing address fields, wrong identity type,
 * unsupported area level, etc.).
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/emergency-requirement-validations.ts
 */
import { DidwwClient, Environment } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  // Pick any emergency requirement + address + identity from your account.
  const requirements = await client.emergencyRequirements().list();
  const addresses = await client.addresses().list();
  const identities = await client.identities().list();

  const requirement = requirements.data[0];
  const address = addresses.data[0];
  const identity = identities.data[0];

  if (!requirement) throw new Error('No emergency_requirements found on this account');
  if (!address) throw new Error('No addresses found on this account');
  if (!identity) throw new Error('No identities found on this account');

  console.log('Validating order setup with:');
  console.log(`  Emergency Requirement: ${requirement.id}`);
  console.log(`  Address:               ${address.id}`);
  console.log(`  Identity:              ${identity.id}`);

  try {
    await client.emergencyRequirementValidations().create({
      emergencyRequirement: { id: requirement.id, type: 'emergency_requirements' },
      address: { id: address.id, type: 'addresses' },
      identity: { id: identity.id, type: 'identities' },
    });
    console.log('\nValidation passed — this combination can be used to order emergency calling.');
  } catch (err) {
    console.log('\nValidation failed:');
    console.error(err);
  }
}

await main();
