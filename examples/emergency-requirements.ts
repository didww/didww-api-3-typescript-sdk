/**
 * Emergency Requirements: list emergency service requirements for a
 * country and number type.
 *
 * Emergency requirements describe what address precision, identity type,
 * and supporting fields an end-customer must provide to enable 911/112
 * on a DID.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/emergency-requirements.ts
 */
import { DidwwClient, Environment, isIncluded } from '../src/index.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  console.log('=== Emergency Requirements ===');
  const requirements = await client.emergencyRequirements().list({
    include: ['country'],
  });
  console.log(`Found ${requirements.data.length} emergency requirements`);

  for (const req of requirements.data.slice(0, 5)) {
    console.log(`\nRequirement: ${req.id}`);
    if (req.country && isIncluded(req.country)) {
      console.log(`  Country: ${req.country.name}`);
    }
    // A NumberType value: local, national, mobile, toll_free, shared_cost or global
    console.log(`  Number type: ${req.numberType}`);
    console.log(`  Identity type required: ${req.identityType}`);
    console.log(`  Address area level: ${req.addressAreaLevel}`);
    console.log(`  Address mandatory fields: ${req.addressMandatoryFields?.join(', ')}`);
    console.log(`  Estimated setup time (days): ${req.estimateSetupTime}`);
    if (req.requirementRestrictionMessage) {
      console.log(`  Restriction: ${req.requirementRestrictionMessage}`);
    }
    if (req.meta) {
      console.log(`  Setup price: ${req.meta.setupPrice}`);
      console.log(`  Monthly price: ${req.meta.monthlyPrice}`);
    }
  }

  // Filter by country
  const firstReq = requirements.data[0];
  if (firstReq?.country) {
    const countryId = firstReq.country.id;
    const countryRef = firstReq.country;
    const countryName = isIncluded(countryRef) ? countryRef.name : countryId;
    console.log(`\n=== Requirements for country ${countryName} ===`);
    const perCountry = await client.emergencyRequirements().list({
      filter: { 'country.id': countryId },
    });
    console.log(`Found ${perCountry.data.length} requirements`);
  }
}

await main();
