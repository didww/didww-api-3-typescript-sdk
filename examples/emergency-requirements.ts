/**
 * Emergency Requirements: list emergency service requirements for a
 * country/did_group_type (2026-04-16).
 *
 * Emergency requirements describe what address precision, identity type,
 * and supporting fields an end-customer must provide to enable 911/112
 * on a DID.
 *
 * Usage: DIDWW_API_KEY=xxx npx tsx examples/emergency-requirements.ts
 */
import { DidwwClient, Environment } from '../src/index.js';
import { isIncluded } from '../src/resources/base.js';

const client = new DidwwClient({
  apiKey: process.env.DIDWW_API_KEY!,
  environment: Environment.SANDBOX,
});

async function main() {
  console.log('=== Emergency Requirements ===');
  const requirements = await client.emergencyRequirements().list({
    include: ['country', 'did_group_type'],
  });
  console.log(`Found ${requirements.data.length} emergency requirements`);

  for (const req of requirements.data.slice(0, 5)) {
    console.log(`\nRequirement: ${req.id}`);
    if (req.country && isIncluded(req.country)) {
      console.log(`  Country: ${req.country.name}`);
    }
    if (req.didGroupType && isIncluded(req.didGroupType)) {
      console.log(`  DID Group Type: ${req.didGroupType.name}`);
    }
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
